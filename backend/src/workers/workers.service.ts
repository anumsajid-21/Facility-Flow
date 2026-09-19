import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators/user.decorator";
import { PaginationDto, buildPage } from "../common/dto/pagination.dto";

/**
 * Provider worker management, including overlap-safe assignment history.
 */
@Injectable()
export class WorkersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(user: AuthUser, q: PaginationDto) {
    if (!user.providerId) throw new ForbiddenException("No provider profile");
    const [total, items] = await Promise.all([
      this.prisma.worker.count({ where: { providerId: user.providerId } }),
      this.prisma.worker.findMany({ where: { providerId: user.providerId }, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" } }),
    ]);
    return buildPage(items, total, q.page, q.limit);
  }

  async get(user: AuthUser, id: string) {
    const w = await this.prisma.worker.findUnique({ where: { id }, include: { assignments: { include: { job: true } } } });
    if (!w) throw new NotFoundException("Worker not found");
    if (w.providerId !== user.providerId) throw new ForbiddenException("Access denied");
    return w;
  }

  async create(user: AuthUser, dto: any) {
    if (user.role !== "PROVIDER" || !user.providerId) throw new ForbiddenException("Only providers can manage workers");
    const w = await this.prisma.worker.create({ data: { ...dto, providerId: user.providerId } });
    void this.audit.log({ actorId: user.userId, action: "WORKER_CREATED", entityType: "Worker", entityId: w.id, details: dto });
    return w;
  }

  async invite(user: AuthUser, id: string, dto: { email: string }) {
    const w = await this.get(user, id);
    if (!dto.email) throw new BadRequestException("Email is required for invitation");
    
    // Check if user already exists
    let existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser && existingUser.role !== "WORKER") {
      throw new ConflictException("Email belongs to a non-worker user");
    }

    if (!existingUser) {
      // Create a user account for the worker with default credentials (e.g. worker123)
      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash("Worker123!", 10);
      existingUser = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          name: w.name,
          role: "WORKER",
          providerId: user.providerId,
        },
      });
    }

    const updated = await this.prisma.worker.update({
      where: { id: w.id },
      data: {
        email: dto.email,
        inviteStatus: "ACTIVE",
        userId: existingUser.id,
      },
    });

    void this.audit.log({ actorId: user.userId, action: "WORKER_INVITED", entityType: "Worker", entityId: id, details: { email: dto.email } });
    return updated;
  }

  async setStatus(user: AuthUser, id: string, status: string) {
    const w = await this.get(user, id);
    const updated = await this.prisma.worker.update({
      where: { id: w.id },
      data: { status },
    });
    void this.audit.log({ actorId: user.userId, action: "WORKER_STATUS_CHANGED", entityType: "Worker", entityId: id, details: { status } });
    return updated;
  }

  async update(user: AuthUser, id: string, dto: any) {
    const w = await this.get(user, id);
    const updated = await this.prisma.worker.update({ where: { id: w.id }, data: { ...dto } });
    void this.audit.log({ actorId: user.userId, action: "WORKER_UPDATED", entityType: "Worker", entityId: id, details: dto });
    return updated;
  }

  async assignments(user: AuthUser, id: string) {
    const w = await this.get(user, id);
    return this.prisma.workerAssignment.findMany({ where: { workerId: w.id }, include: { job: true } });
  }
}
