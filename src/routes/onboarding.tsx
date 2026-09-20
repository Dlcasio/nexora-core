import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Building2, Loader2 } from "lucide-react";

import { AuthLayout } from "@/components/nexora/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentMembership, useInvalidateOrganization } from "@/hooks/use-organization";
import { BUSINESS_TYPES, COMPANY_SIZES } from "@/lib/organizations";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create your organization — NEXORA" },
      { name: "description", content: "Set up your NEXORA organization workspace in one step." },
      { property: "og:title", content: "Create your organization — NEXORA" },
      { property: "og:description", content: "Name your organization and tell us how you operate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    const membership = await fetchCurrentMembership();
    if (membership) throw redirect({ to: "/dashboard" });
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const invalidate = useInvalidateOrganization();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length >= 2 && businessType && companySize;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setSaving(false);
      setError("Your session expired. Please sign in again.");
      return;
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: name.trim(),
        business_type: businessType,
        company_size: companySize,
        created_by: userId,
      })
      .select("id")
      .single();

    if (orgError || !org) {
      setSaving(false);
      setError(orgError?.message ?? "We couldn't create your organization. Please try again.");
      return;
    }

    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: userId, role: "owner" });

    if (memberError) {
      setSaving(false);
      setError(memberError.message);
      return;
    }

    await supabase
      .from("user_profiles")
      .upsert(
        { user_id: userId, current_organization_id: org.id, onboarding_completed: true },
        { onConflict: "user_id" },
      );

    invalidate();
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <AuthLayout
      title="Create your organization"
      subtitle="NEXORA works around your organization. Set it up once — you can refine the details later."
      footer={<span>You'll be the owner of this organization.</span>}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="flex items-center gap-3 rounded-md border border-border bg-background/50 px-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">
            <Building2 className="size-4" />
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Step 1 of 1 · Organization details
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-name">Organization name</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Industries"
            autoComplete="organization"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="business-type">Business type</Label>
          <Select value={businessType} onValueChange={setBusinessType}>
            <SelectTrigger id="business-type" className="w-full">
              <SelectValue placeholder="Select a business type" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-size">Company size</Label>
          <Select value={companySize} onValueChange={setCompanySize}>
            <SelectTrigger id="company-size" className="w-full">
              <SelectValue placeholder="Select a company size" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={!valid || saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Creating organization…" : "Create organization"}
        </Button>
      </form>
    </AuthLayout>
  );
}
