import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface MatchScore {
  providerId: string;
  score: number;
  explanation: { factor: string; weight: number; value: number; detail: string }[];
}

/**
 * Explainable rule-based provider matching, behind a replaceable interface.
 *
 * Weights:
 *  Service Match  30%  — does the provider offer the requested category?
 *  Location       20%  — does the provider serve the request location?
 *  Rating         15%  — aggregate provider rating (0..5), needs >2 reviews
 *  Experience     15%  — years of experience declared by the provider
 *  Availability   10%  — workforce capacity vs requested workers
 *  Price          10%  — lower average quotation price => higher score
 *
 * Missing information is never fabricated: uncomputable factors report
 * value 0 with an explanation of the gap.
 */
@Injectable()
export class MatchingService {
  static readonly WEIGHTS = { serviceMatch: 0.3, location: 0.2, rating: 0.15, experience: 0.15, availability: 0.1, price: 0.1 };

  constructor(private prisma: PrismaService) {}

  async match(serviceRequestId: string): Promise<MatchScore[]> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: { building: { include: { organization: true } } },
    });
    if (!request) throw new Error("Service request not found");

    const categoryId = request.categoryId;
    const city = request.building?.city;
    const requestedWorkers = 2;

    const providers = await this.prisma.provider.findMany({
      where: { verificationStatus: { in: ["VERIFIED", "DOCUMENTS_SUBMITTED"] } },
      include: { services: categoryId ? { where: { categoryId } } : true, serviceAreas: true },
    });

    const providerIds = providers.map((p) => p.id);

    const agg = await this.prisma.review.groupBy({
      by: ["providerId"],
      where: { providerId: { in: providerIds } },
      _avg: { overallRating: true },
      _count: true,
    });
    const aggMap = new Map(agg.map((a) => [a.providerId, a]));

    const priceAgg = await this.prisma.quotation.groupBy({
      by: ["providerId"],
      where: { providerId: { in: providerIds } },
      _avg: { price: true },
    });
    const priceMap = new Map(priceAgg.map((p) => [p.providerId, Number(p._avg.price ?? 0)]));

    const prices = Array.from(priceMap.values());
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;

    const scores = providers.map((p): MatchScore => {
      const explanation: MatchScore["explanation"] = [];

      const hasService = p.services.length > 0;
      explanation.push({
        factor: "Service Match",
        weight: MatchingService.WEIGHTS.serviceMatch,
        value: hasService ? 1 : 0,
        detail: hasService ? "Offers this service category" : "Does not offer this category — score 0",
      });

      let locationScore = 0;
      let locationDetail = "No location preference provided — score 0";
      if (city) {
        const serves = p.serviceAreas.some((a: { areaName: string }) => a.areaName?.toLowerCase() === city.toLowerCase());
        locationScore = serves ? 1 : 0;
        locationDetail = serves ? `Serves ${city}` : `Does not serve ${city}`;
      }
      explanation.push({ factor: "Location", weight: MatchingService.WEIGHTS.location, value: locationScore, detail: locationDetail });

      const r = aggMap.get(p.id);
      let ratingScore = 0;
      let ratingDetail = "No reviews yet — score 0";
      if (r && r._avg?.overallRating) {
        const avg = Number(r._avg.overallRating);
        if (r._count > 2) {
          ratingScore = avg / 5;
          ratingDetail = `${r._count} reviews, avg ${avg.toFixed(1)}/5`;
        } else {
          ratingDetail = `${r._count} reviews (need >2 for a stable average) — score 0`;
        }
      }
      explanation.push({ factor: "Rating", weight: MatchingService.WEIGHTS.rating, value: ratingScore, detail: ratingDetail });

      let expScore = 0;
      let expDetail = "Experience not declared — score 0";
      if (p.experience) {
        const years = Number(p.experience) || 0;
        expScore = Math.min(years / 10, 1);
        expDetail = `${years} years experience`;
      }
      explanation.push({ factor: "Experience", weight: MatchingService.WEIGHTS.experience, value: expScore, detail: expDetail });

      let availScore = 0;
      let availDetail = "Capacity not declared — score 0";
      if (p.workforceCapacity) {
        availScore = Math.min(p.workforceCapacity / requestedWorkers, 1);
        availDetail = `${p.workforceCapacity} capacity vs ${requestedWorkers} requested`;
      }
      explanation.push({ factor: "Availability", weight: MatchingService.WEIGHTS.availability, value: availScore, detail: availDetail });

      let priceScore = 0;
      let priceRangeDetail = "No quotation price data — score 0";
      const avg = priceMap.get(p.id);
      if (avg !== undefined && maxPrice > minPrice) {
        priceScore = (maxPrice - avg) / (maxPrice - minPrice);
        priceRangeDetail = `Avg quotation $${avg.toFixed(2)}`;
      } else if (avg !== undefined) {
        priceRangeDetail = `Avg quotation $${avg.toFixed(2)} (single known price)`;
      }
      explanation.push({ factor: "Price", weight: MatchingService.WEIGHTS.price, value: priceScore, detail: priceRangeDetail });

      const score = explanation.reduce((sum, e) => sum + e.weight * e.value, 0);
      return { providerId: p.id, score: Number((score * 100).toFixed(2)), explanation };
    });

    return scores.sort((a, b) => b.score - a.score);
  }
}

