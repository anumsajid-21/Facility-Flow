"use client";

import { useEffect, useState } from "react";
import { User, Shield, Bell, Building, CreditCard, Check, RefreshCw, Camera, FileText, CheckCircle, Plus } from "lucide-react";
import { settingsApi, providersApi, facilitiesApi, proofApi, jobsApi, filesApi, apiError } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { Card, PageHeader, Field, Input, Textarea, Loading, Tabs, Modal, Select } from "@/components/ui/kit";
import { Button } from "@/components/ui/button";
import { toast } from "@/store/toast";
import { dateShort } from "@/lib/utils";

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    avatarUrl: "",
    orgName: "",
    orgDescription: "",
    orgContactEmail: "",
    orgContactPhone: "",
    orgLogoUrl: "",
    providerName: "",
    providerDescription: "",
    providerContactInfo: "",
    providerLogoUrl: "",
  });

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  // Notifications Form
  const [notifForm, setNotifForm] = useState({
    inApp: true,
    email: true,
    categories: {
      QUOTATION_RECEIVED: { inApp: true, email: true },
      JOB_STATUS_CHANGE: { inApp: true, email: true },
      APPROVAL: { inApp: true, email: true },
      PAYMENT: { inApp: true, email: true },
    },
  });

  // Provider Payout & Business Form
  const [providerForm, setProviderForm] = useState({
    bankName: "",
    accountNumber: "",
    routingNumber: "",
    serviceAreaText: "",
    selectedCategories: [] as string[],
  });

  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [proofsList, setProofsList] = useState<any[]>([]);
  const [openUpload, setOpenUpload] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [proofForm, setProofForm] = useState({ providerNote: "", completionNote: "", workerName: "" });
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const me = await settingsApi.me();
      setProfileForm({
        name: me.name || "",
        email: me.email || "",
        phone: me.phone || "",
        avatarUrl: me.avatarUrl || "",
        orgName: me.hiringOrg?.name || "",
        orgDescription: me.hiringOrg?.description || "",
        orgContactEmail: me.hiringOrg?.contactEmail || "",
        orgContactPhone: me.hiringOrg?.contactPhone || "",
        orgLogoUrl: me.hiringOrg?.logoUrl || "",
        providerName: me.provider?.name || "",
        providerDescription: me.provider?.description || "",
        providerContactInfo: me.provider?.contactInfo || "",
        providerLogoUrl: me.provider?.logoUrl || "",
      });

      if (me.provider) {
        setProviderForm({
          bankName: me.provider.bankName || "",
          accountNumber: me.provider.accountNumber || "",
          routingNumber: me.provider.routingNumber || "",
          serviceAreaText: me.provider.serviceAreaText || "",
          selectedCategories: me.provider.services?.map((s: any) => s.categoryId) || [],
        });
        if (me.provider.id) {
          proofApi.byProvider(me.provider.id).then(setProofsList).catch(() => setProofsList([]));
        }
      }

      const notifs = await settingsApi.getNotifications();
      if (notifs) {
        setNotifForm({
          inApp: notifs.inApp ?? true,
          email: notifs.email ?? true,
          categories: (notifs.categories as any) || {
            QUOTATION_RECEIVED: { inApp: true, email: true },
            JOB_STATUS_CHANGE: { inApp: true, email: true },
            APPROVAL: { inApp: true, email: true },
            PAYMENT: { inApp: true, email: true },
          },
        });
      }

      const sess = await settingsApi.getSession();
      setSessionInfo(sess);
    } catch (e: any) {
      toast.error("Failed to load settings", apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const previousUser = { ...user };
    const newName = profileForm.name.trim();

    // Optimistic UI update
    updateUser({ name: newName, phone: profileForm.phone, avatarUrl: profileForm.avatarUrl });
    setSavingProfile(true);

    try {
      const payload: any = {
        name: newName,
        phone: profileForm.phone,
        avatarUrl: profileForm.avatarUrl,
      };

      if (user?.role === "HIRING_ORG") {
        payload.hiringOrg = {
          name: profileForm.orgName,
          description: profileForm.orgDescription,
          contactEmail: profileForm.orgContactEmail,
          contactPhone: profileForm.orgContactPhone,
          logoUrl: profileForm.orgLogoUrl,
        };
      } else if (user?.role === "PROVIDER") {
        payload.provider = {
          name: profileForm.providerName,
          description: profileForm.providerDescription,
          contactInfo: profileForm.providerContactInfo,
          logoUrl: profileForm.providerLogoUrl,
        };
      }

      const updated = await settingsApi.updateProfile(payload);
      updateUser({ name: updated.name, avatarUrl: updated.avatarUrl, phone: updated.phone });
      toast.success("Profile updated", "Your account settings have been saved.");
    } catch (e: any) {
      // Rollback on error
      if (previousUser.name) updateUser(previousUser);
      toast.error("Update failed", apiError(e));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleImageSelect = (field: "avatarUrl" | "providerLogoUrl") => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      toast.error("Invalid image", "Choose an image smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfileForm((current) => ({ ...current, [field]: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match", "Please verify your new password.");
      return;
    }
    setSavingPassword(true);
    try {
      await settingsApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed", "Your password has been updated.");
    } catch (e: any) {
      toast.error("Password change failed", apiError(e));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifs(true);
    try {
      await settingsApi.updateNotifications(notifForm);
      toast.success("Preferences saved", "Notification settings updated.");
    } catch (e: any) {
      toast.error("Failed to save", apiError(e));
    } finally {
      setSavingNotifs(false);
    }
  };

  const handleSaveProviderDetails = async () => {
    setSavingProvider(true);
    try {
      await settingsApi.updateProfile({
        provider: {
          bankName: providerForm.bankName,
          accountNumber: providerForm.accountNumber,
          routingNumber: providerForm.routingNumber,
          serviceAreaText: providerForm.serviceAreaText,
        },
      });
      toast.success("Business details saved", "Payout and service area details updated.");
    } catch (e: any) {
      toast.error("Update failed", apiError(e));
    } finally {
      setSavingProvider(false);
    }
  };

  const openUploadModal = async () => {
    try {
      const jRes = await jobsApi.list({ limit: 100 });
      const inProg = (jRes.data || []).filter((j: any) => j.status === "IN_PROGRESS" || j.status === "REWORK");
      setAvailableJobs(inProg);
      if (inProg.length > 0) setSelectedJobId(inProg[0].id);
      setOpenUpload(true);
    } catch (e: any) {
      toast.error("Failed to load jobs", e?.message);
    }
  };

  const handleUploadProof = async () => {
    if (!selectedJobId) return toast.error("Required", "Select a job first.");
    setUploading(true);
    try {
      const uploadFiles = async (files: File[], kind: string) => {
        const ids: string[] = [];
        for (const f of files) {
          const res = await filesApi.upload(f, kind);
          ids.push(res.id);
        }
        return ids;
      };
      const bIds = await uploadFiles(beforeFiles, "JOB_PHOTO");
      const aIds = await uploadFiles(afterFiles, "JOB_PHOTO");
      await proofApi.add(selectedJobId, proofForm, bIds, aIds);
      toast.success("Proof of Work added!", "Evidence attached to job.");
      setOpenUpload(false);
      setBeforeFiles([]);
      setAfterFiles([]);
      setProofForm({ providerNote: "", completionNote: "", workerName: "" });
      loadSettings();
    } catch (e: any) {
      toast.error("Failed to add proof", e?.message);
    } finally {
      setUploading(false);
    }
  };

  const tabsList = [
    { key: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
    { key: "security", label: "Security", icon: <Shield className="h-4 w-4" /> },
    { key: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
    ...(user?.role === "PROVIDER" ? [
      { key: "payouts", label: "Business & Payouts", icon: <CreditCard className="h-4 w-4" /> },
      { key: "proofs", label: "Proof of Work Portfolio", icon: <Camera className="h-4 w-4" /> },
    ] : []),
  ];

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your profile, security, and preferences" />

      <Tabs tabs={tabsList} active={activeTab} onChange={setActiveTab} />

      {activeTab === "profile" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-semibold text-charcoal flex items-center gap-2">
                <User className="h-4 w-4 text-pine" /> Personal Info
              </h3>
            </div>
            <div className="space-y-4 p-5">
              <Field label="Full Name">
                <Input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
              </Field>
              <Field label="Email Address">
                <Input value={profileForm.email} readOnly className="bg-muted/40 text-sage" />
              </Field>
              <Field label="Phone Number">
                <Input value={profileForm.phone} placeholder="+1 (555) 000-0000" onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
              </Field>
              <Field label="Avatar URL">
                <Input value={profileForm.avatarUrl} placeholder="https://..." onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })} />
              </Field>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-sm text-sage hover:border-pine hover:text-pine">
                <span>Choose profile picture</span>
                <input type="file" accept="image/*" className="sr-only" onChange={handleImageSelect("avatarUrl")} />
              </label>
              {profileForm.avatarUrl && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <img src={profileForm.avatarUrl} alt="Profile preview" className="h-12 w-12 rounded-full object-cover" />
                  <p className="text-xs text-sage">This photo appears on your account profile.</p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveProfile} loading={savingProfile}>Save Profile</Button>
              </div>
            </div>
          </Card>

          {user?.role === "HIRING_ORG" && (
            <Card>
              <div className="border-b border-border px-5 py-4">
                <h3 className="font-semibold text-charcoal flex items-center gap-2">
                  <Building className="h-4 w-4 text-pine" /> Organization Details
                </h3>
              </div>
              <div className="space-y-4 p-5">
                <Field label="Organization Name">
                  <Input value={profileForm.orgName} onChange={(e) => setProfileForm({ ...profileForm, orgName: e.target.value })} />
                </Field>
                <Field label="Contact Email">
                  <Input value={profileForm.orgContactEmail} onChange={(e) => setProfileForm({ ...profileForm, orgContactEmail: e.target.value })} />
                </Field>
                <Field label="Contact Phone">
                  <Input value={profileForm.orgContactPhone} onChange={(e) => setProfileForm({ ...profileForm, orgContactPhone: e.target.value })} />
                </Field>
                <Field label="Description">
                  <Textarea value={profileForm.orgDescription} onChange={(e) => setProfileForm({ ...profileForm, orgDescription: e.target.value })} />
                </Field>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveProfile} loading={savingProfile}>Save Organization</Button>
                </div>
              </div>
            </Card>
          )}

          {user?.role === "PROVIDER" && (
            <Card>
              <div className="border-b border-border px-5 py-4">
                <h3 className="font-semibold text-charcoal flex items-center gap-2">
                  <Building className="h-4 w-4 text-pine" /> Provider Company Profile
                </h3>
              </div>
              <div className="space-y-4 p-5">
                <Field label="Company Name">
                  <Input value={profileForm.providerName} onChange={(e) => setProfileForm({ ...profileForm, providerName: e.target.value })} />
                </Field>
                <Field label="Contact Information">
                  <Input value={profileForm.providerContactInfo} onChange={(e) => setProfileForm({ ...profileForm, providerContactInfo: e.target.value })} />
                </Field>
                <Field label="Company Description">
                  <Textarea value={profileForm.providerDescription} onChange={(e) => setProfileForm({ ...profileForm, providerDescription: e.target.value })} />
                </Field>
                <Field label="Company Profile Picture URL">
                  <Input value={profileForm.providerLogoUrl} placeholder="https://..." onChange={(e) => setProfileForm({ ...profileForm, providerLogoUrl: e.target.value })} />
                </Field>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-sm text-sage hover:border-pine hover:text-pine">
                  <span>Choose company profile picture</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={handleImageSelect("providerLogoUrl")} />
                </label>
                {profileForm.providerLogoUrl && (
                  <img src={profileForm.providerLogoUrl} alt="Company profile preview" className="h-20 w-20 rounded-xl object-cover ring-1 ring-border" />
                )}
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveProfile} loading={savingProfile}>Save Provider Info</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === "security" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-semibold text-charcoal flex items-center gap-2">
                <Shield className="h-4 w-4 text-pine" /> Change Password
              </h3>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4 p-5">
              <Field label="Current Password">
                <Input type="password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
              </Field>
              <Field label="New Password">
                <Input type="password" required value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
              </Field>
              <Field label="Confirm New Password">
                <Input type="password" required value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
              </Field>
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={savingPassword}>Update Password</Button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-semibold text-charcoal flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-pine" /> Active Session Info
              </h3>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between border-b border-border py-2">
                <span className="text-sage font-medium">Logged in as</span>
                <span className="text-charcoal font-semibold">{user?.email}</span>
              </div>
              <div className="flex justify-between border-b border-border py-2">
                <span className="text-sage font-medium">User Role</span>
                <span className="uppercase text-pine font-bold">{user?.role}</span>
              </div>
              <div className="flex justify-between border-b border-border py-2">
                <span className="text-sage font-medium">IP Address</span>
                <span className="text-charcoal">{sessionInfo?.ip || "127.0.0.1"}</span>
              </div>
              <div className="flex justify-between border-b border-border py-2">
                <span className="text-sage font-medium">User Agent</span>
                <span className="text-charcoal max-w-xs truncate">{sessionInfo?.userAgent || "Browser"}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "notifications" && (
        <Card>
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-semibold text-charcoal flex items-center gap-2">
              <Bell className="h-4 w-4 text-pine" /> Notification Preferences
            </h3>
          </div>
          <div className="p-5 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h4 className="font-semibold text-charcoal">Global In-App Notifications</h4>
                <p className="text-xs text-sage">Receive notifications in the top bar bell menu.</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-border text-pine focus:ring-pine"
                checked={notifForm.inApp}
                onChange={(e) => setNotifForm({ ...notifForm, inApp: e.target.checked })}
              />
            </div>

            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h4 className="font-semibold text-charcoal">Global Email Notifications</h4>
                <p className="text-xs text-sage">Receive transactional email notifications.</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-border text-pine focus:ring-pine"
                checked={notifForm.email}
                onChange={(e) => setNotifForm({ ...notifForm, email: e.target.checked })}
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-charcoal text-sm uppercase text-sage">Notification Event Controls</h4>

              {[
                { key: "QUOTATION_RECEIVED", title: "Quotation Received / Submitted", desc: "When a quotation is received or submitted." },
                { key: "JOB_STATUS_CHANGE", title: "Job Status Changes", desc: "When a job moves to in-progress, proof, or complete." },
                { key: "APPROVAL", title: "Job Approvals & Rework", desc: "When job proof is approved or rework is requested." },
                { key: "PAYMENT", title: "Invoice & Payment Updates", desc: "When an invoice is issued or payment is recorded." },
              ].map((item) => {
                const catState = (notifForm.categories as any)[item.key] || { inApp: true, email: true };
                return (
                  <div key={item.key} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <h5 className="font-medium text-charcoal text-sm">{item.title}</h5>
                      <p className="text-xs text-sage">{item.desc}</p>
                    </div>
                    <div className="flex gap-4 items-center text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={catState.inApp}
                          onChange={(e) =>
                            setNotifForm({
                              ...notifForm,
                              categories: {
                                ...notifForm.categories,
                                [item.key]: { ...catState, inApp: e.target.checked },
                              },
                            })
                          }
                        />
                        <span>In-App</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={catState.email}
                          onChange={(e) =>
                            setNotifForm({
                              ...notifForm,
                              categories: {
                                ...notifForm.categories,
                                [item.key]: { ...catState, email: e.target.checked },
                              },
                            })
                          }
                        />
                        <span>Email</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveNotifications} loading={savingNotifs}>Save Preferences</Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === "payouts" && user?.role === "PROVIDER" && (
        <Card>
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-semibold text-charcoal flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-pine" /> Business & Payout Details
            </h3>
          </div>
          <div className="p-5 space-y-4 max-w-xl">
            <Field label="Service Areas Covered">
              <Input
                value={providerForm.serviceAreaText}
                placeholder="e.g. Greater Austin Area, Downtown, North Campus"
                onChange={(e) => setProviderForm({ ...providerForm, serviceAreaText: e.target.value })}
              />
            </Field>

            <Field label="Bank Name">
              <Input
                value={providerForm.bankName}
                placeholder="Chase Bank / Bank of America"
                onChange={(e) => setProviderForm({ ...providerForm, bankName: e.target.value })}
              />
            </Field>

            <Field label="Account Number">
              <Input
                type="password"
                value={providerForm.accountNumber}
                placeholder="••••••••1234"
                onChange={(e) => setProviderForm({ ...providerForm, accountNumber: e.target.value })}
              />
            </Field>

            <Field label="Routing Number">
              <Input
                value={providerForm.routingNumber}
                placeholder="123456789"
                onChange={(e) => setProviderForm({ ...providerForm, routingNumber: e.target.value })}
              />
            </Field>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveProviderDetails} loading={savingProvider}>Save Business Details</Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === "proofs" && user?.role === "PROVIDER" && (
        <Card>
          <div className="border-b border-border px-5 py-4 flex items-center justify-between">
            <h3 className="font-semibold text-charcoal flex items-center gap-2">
              <Camera className="h-4 w-4 text-pine" /> Proof of Work Portfolio ({proofsList.length})
            </h3>
            <Button onClick={openUploadModal} className="gap-2 bg-pine text-white text-xs">
              <Plus className="h-3.5 w-3.5" /> Upload Proof of Work
            </Button>
          </div>
          <div className="p-5 space-y-4">
            {proofsList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-sage">
                No proof of work submitted yet. Click &quot;Upload Proof of Work&quot; to upload evidence.
              </div>
            ) : (
              <div className="space-y-4">
                {proofsList.map((pow: any) => (
                  <div key={pow.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/20 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                      <div>
                        <span className="font-bold text-base text-charcoal">{pow.job?.title || pow.job?.serviceName || "Completed Job"}</span>
                        <span className="ml-2 text-xs text-sage">· {pow.job?.building?.name || "Facility"}</span>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-300">
                        ✓ PROOF SUBMITTED
                      </span>
                    </div>

                    {pow.workerName && (
                      <p className="text-xs text-sage font-medium">
                        Completed by: <span className="font-semibold text-charcoal">{pow.workerName}</span> · {dateShort(pow.completedAt)}
                      </p>
                    )}

                    {pow.providerNote && (
                      <div className="rounded-lg bg-white p-3 border border-border">
                        <p className="text-xs font-bold text-pine uppercase">Diagnostic Note</p>
                        <p className="text-sm text-charcoal mt-0.5">{pow.providerNote}</p>
                      </div>
                    )}

                    {pow.completionNote && (
                      <div className="rounded-lg bg-emerald-100/50 p-3 border border-emerald-200">
                        <p className="text-xs font-bold text-emerald-900 uppercase">Completion Summary</p>
                        <p className="text-sm text-charcoal mt-0.5">{pow.completionNote}</p>
                      </div>
                    )}

                    {/* Photos */}
                    <div className="grid gap-3 sm:grid-cols-2 pt-1">
                      {pow.beforePhotos?.length > 0 && (
                        <div className="rounded-lg bg-white p-3 border border-border">
                          <p className="text-xs font-bold text-amber-800 uppercase mb-2 flex items-center gap-1">
                            <Camera className="h-3.5 w-3.5 text-amber-600" /> Before Photos ({pow.beforePhotos.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {pow.beforePhotos.map((f: any) => (
                              <a
                                key={f.id}
                                href={filesApi.url(f.id)}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 border border-amber-200 hover:bg-amber-100"
                              >
                                <FileText className="h-3.5 w-3.5 text-amber-700" />
                                <span className="truncate max-w-[140px]">{f.originalName}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {pow.afterPhotos?.length > 0 && (
                        <div className="rounded-lg bg-white p-3 border border-border">
                          <p className="text-xs font-bold text-emerald-800 uppercase mb-2 flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> After Photos ({pow.afterPhotos.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {pow.afterPhotos.map((f: any) => (
                              <a
                                key={f.id}
                                href={filesApi.url(f.id)}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
                              >
                                <FileText className="h-3.5 w-3.5 text-emerald-700" />
                                <span className="truncate max-w-[140px]">{f.originalName}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Upload Proof Modal */}
      <Modal open={openUpload} onClose={() => setOpenUpload(false)} title="Upload Proof of Work" wide>
        <div className="space-y-4">
          <Field label="Select Job *">
            <Select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
              {availableJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title || j.serviceName || "Job"} ({j.status}) · {j.building?.name || "Building"}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Worker Name">
            <Input
              value={proofForm.workerName}
              onChange={(e) => setProofForm({ ...proofForm, workerName: e.target.value })}
              placeholder="e.g. John Doe / Lead Technician"
            />
          </Field>

          <Field label="Provider Diagnostic Note">
            <Textarea
              value={proofForm.providerNote}
              onChange={(e) => setProofForm({ ...proofForm, providerNote: e.target.value })}
              placeholder="Detailed observations and work done…"
            />
          </Field>

          <Field label="Final Completion Summary">
            <Textarea
              value={proofForm.completionNote}
              onChange={(e) => setProofForm({ ...proofForm, completionNote: e.target.value })}
              placeholder="Final notes for client approval…"
            />
          </Field>

          <Field label="Before Photos">
            <input
              type="file"
              accept="image/*"
              multiple
              className="block w-full rounded-lg border border-input bg-ivory px-3 py-2 text-sm text-charcoal file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-charcoal"
              onChange={(e) => setBeforeFiles(Array.from(e.target.files ?? []))}
            />
            {beforeFiles.length > 0 && <p className="mt-1 text-xs text-sage">{beforeFiles.length} file(s) selected</p>}
          </Field>

          <Field label="After Photos">
            <input
              type="file"
              accept="image/*"
              multiple
              className="block w-full rounded-lg border border-input bg-ivory px-3 py-2 text-sm text-charcoal file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium file:text-charcoal"
              onChange={(e) => setAfterFiles(Array.from(e.target.files ?? []))}
            />
            {afterFiles.length > 0 && <p className="mt-1 text-xs text-sage">{afterFiles.length} file(s) selected</p>}
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenUpload(false)}>Cancel</Button>
            <Button loading={uploading} onClick={handleUploadProof} className="gap-2 bg-pine text-white">
              <Camera className="h-4 w-4" /> Submit Proof of Work
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}