import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { Firm, FirmBrainConfig } from "@leadpilot/shared";
import type { FirmKnowledgeUploadResult } from "@leadpilot/firm-rag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createFirmProvisioning,
  saveFirmBrainProvisioning,
  uploadFirmKnowledgeProvisioning,
} from "./server";
import { FIRM_INDUSTRY_OPTIONS } from "./validators";

const INDUSTRY_LABELS: Record<(typeof FIRM_INDUSTRY_OPTIONS)[number], string> = {
  legal: "Legal",
  healthcare: "Healthcare",
  accounting: "Accounting",
  consulting: "Consulting",
  real_estate: "Real estate",
  general: "General",
};

const fieldClassName =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40";

type MarkdownUploadResult = Pick<FirmKnowledgeUploadResult, "contentHash" | "revision">;

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsText(file);
  });
}

function MarkdownUploadCard<TUploadResult extends MarkdownUploadResult>(props: {
  inputId: string;
  title: string;
  description: string;
  helperText: string;
  buttonLabel: string;
  firmSlug: string;
  uploadServerFn: Parameters<typeof useServerFn>[0];
  onSuccess?: (result: TUploadResult) => void;
}) {
  const uploadMarkdown = useServerFn(props.uploadServerFn);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Choose a .md file before saving.");
      return;
    }

    if (!/\.md$/i.test(selectedFile.name)) {
      setErrorMessage("Please choose a .md file.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const contentMarkdown = await readFileText(selectedFile);
      const result = (await uploadMarkdown({
        data: {
          firmSlug: props.firmSlug,
          filename: selectedFile.name,
          contentMarkdown,
        },
      })) as TUploadResult;

      const hashPreview = result.contentHash.slice(0, 12);
      setStatusMessage(`Saved. Revision ${result.revision}, hash ${hashPreview}...`);
      props.onSuccess?.(result);
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="border-border/60 bg-card rounded-3xl border p-4 shadow-[0_16px_40px_rgba(18,34,42,0.06)]">
      <div className="space-y-2">
        <h3 className="text-foreground text-sm font-semibold tracking-tight">{props.title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{props.description}</p>
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div className="space-y-2">
          <label htmlFor={props.inputId} className="text-foreground text-sm font-medium">
            .md file
          </label>
          <Input
            ref={inputRef}
            id={props.inputId}
            type="file"
            accept=".md,text/markdown"
            aria-label={props.title}
            disabled={isSubmitting}
            onChange={(event) => {
              setSelectedFile(event.currentTarget.files?.[0] ?? null);
              setErrorMessage(null);
              setStatusMessage(null);
            }}
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            {selectedFile ? selectedFile.name : props.helperText}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting || !selectedFile} className="rounded-full px-4">
            {isSubmitting ? "Saving..." : props.buttonLabel}
          </Button>
        </div>
      </form>

      {errorMessage ? (
        <p
          className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {statusMessage ? (
        <p
          className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground"
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}

function BrainReadoutCard(props: { brainConfig: FirmBrainConfig | null }) {
  return (
    <section className="border-border/60 bg-card mt-4 rounded-3xl border p-4">
      <div className="space-y-2">
        <h3 className="text-foreground text-sm font-semibold tracking-tight">Live brain readout</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Stored control-plane brain snapshot for the current firm.
        </p>
      </div>

      {props.brainConfig ? (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2">
              <dt className="text-muted-foreground text-xs uppercase tracking-[0.12em]">Revision</dt>
              <dd className="text-foreground mt-1 font-medium">{props.brainConfig.revision}</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2">
              <dt className="text-muted-foreground text-xs uppercase tracking-[0.12em]">Hash</dt>
              <dd className="text-foreground mt-1 font-medium font-mono text-xs break-all">
                {props.brainConfig.contentHash}
              </dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2">
              <dt className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
                Source file
              </dt>
              <dd className="text-foreground mt-1 font-medium">{props.brainConfig.sourceFilename}</dd>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2">
              <dt className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
                Compiled at
              </dt>
              <dd className="text-foreground mt-1 font-medium">
                {new Date(props.brainConfig.compiledAt).toLocaleString()}
              </dd>
            </div>
          </dl>

          {props.brainConfig.compiled.businessSummary ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-3">
              <p className="text-muted-foreground text-xs uppercase tracking-[0.12em]">Summary</p>
              <p className="text-foreground mt-1 text-sm leading-relaxed">
                {props.brainConfig.compiled.businessSummary}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          No stored brain yet. Upload the firm brain markdown to publish the live snapshot.
        </p>
      )}
    </section>
  );
}

function TenantCreationCard(props: { onCreated?: (firm: Firm) => void }) {
  const provisionFirm = useServerFn(createFirmProvisioning);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "");
    const industry = String(formData.get("industry") ?? "");

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const firm = await provisionFirm({
        data: {
          name,
          industry,
        },
      });
      props.onCreated?.(firm);
      setStatusMessage(`Tenant provisioned. Slug: ${firm.slug}.`);
      form.reset();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Tenant provisioning failed. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-border/70 bg-[linear-gradient(180deg,#ffffff_0%,#f7fafb_100%)] p-5 shadow-[0_24px_60px_rgba(18,34,42,0.08)] sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]"
          >
            Internal only
          </Badge>
          <h2 className="mt-3 text-lg font-semibold tracking-tight">Provision a tenant</h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
            Enter a business name and industry. The backend will create the firm row and generate
            the slug that powers both the dashboard and ask pages.
          </p>
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div className="space-y-2">
          <label htmlFor="firm-name" className="text-foreground text-sm font-medium">
            Business name
          </label>
          <Input
            id="firm-name"
            name="name"
            autoComplete="organization"
            placeholder="Northline Advisory"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="firm-industry" className="text-foreground text-sm font-medium">
            Industry
          </label>
          <select
            id="firm-industry"
            name="industry"
            defaultValue="consulting"
            disabled={isSubmitting}
            className={fieldClassName}
          >
            {FIRM_INDUSTRY_OPTIONS.map((industry) => (
              <option key={industry} value={industry}>
                {INDUSTRY_LABELS[industry]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn("rounded-full px-5", isSubmitting && "cursor-wait")}
          >
            {isSubmitting ? "Creating tenant..." : "Create tenant"}
          </Button>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Slugs are generated automatically and reused for both routes.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            After creation, this panel switches to the knowledge base and firm brain upload cards
            for the new tenant.
          </p>
        </div>
      </form>

      {statusMessage ? (
        <p
          className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground"
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}

function FirmWorkspaceCard(props: {
  firm: Firm;
  brainConfig: FirmBrainConfig | null;
}) {
  const [brainConfig, setBrainConfig] = useState<FirmBrainConfig | null>(props.brainConfig);

  useEffect(() => {
    setBrainConfig(props.brainConfig);
  }, [props.brainConfig]);

  return (
    <section className="border-border/60 bg-card rounded-[28px] border p-5 shadow-[0_16px_40px_rgba(18,34,42,0.06)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-foreground text-lg font-semibold tracking-tight">{props.firm.name}</p>
          <p className="text-muted-foreground mt-1 text-xs uppercase tracking-[0.12em]">
            {INDUSTRY_LABELS[props.firm.industry]}
          </p>
        </div>
        <code className="bg-muted/70 text-foreground rounded-full px-3 py-1 font-mono text-xs">
          {props.firm.slug}
        </code>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild className="rounded-full px-4">
          <Link to="/dashboard/$firmSlug" params={{ firmSlug: props.firm.slug }}>
            Open dashboard
          </Link>
        </Button>
        <Button asChild variant="secondary" className="rounded-full px-4">
          <Link to="/ask/$firmSlug" params={{ firmSlug: props.firm.slug }}>
            Open ask page
          </Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <MarkdownUploadCard<FirmKnowledgeUploadResult>
          inputId={`knowledge-base-upload-${props.firm.slug}`}
          title="Knowledge base upload"
          description="Upload the pre-processed company knowledge base markdown. This keeps the existing KB ingestion, embedding, and publish path."
          helperText="Choose a .md file with public company information."
          buttonLabel="Save knowledge base"
          firmSlug={props.firm.slug}
          uploadServerFn={uploadFirmKnowledgeProvisioning}
        />
        <MarkdownUploadCard<FirmBrainConfig>
          inputId={`brain-upload-${props.firm.slug}`}
          title="Firm brain upload"
          description="Upload the structured brain markdown. It compiles into the live control-plane brain for new conversations."
          helperText="Choose a structured .md file with the firm brain template."
          buttonLabel="Save brain"
          firmSlug={props.firm.slug}
          uploadServerFn={saveFirmBrainProvisioning}
          onSuccess={(result) => setBrainConfig(result)}
        />
      </div>

      <BrainReadoutCard brainConfig={brainConfig} />
    </section>
  );
}

function FirmSelectionEmptyState(props: { selectionError: string | null }) {
  return (
    <section className="border-border/60 bg-card rounded-[28px] border p-5 shadow-[0_16px_40px_rgba(18,34,42,0.06)] sm:p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Select a firm</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Choose a firm from the sidebar to load its dashboard links, knowledge base uploads, and
          live brain snapshot.
        </p>
      </div>

      {props.selectionError ? (
        <p
          className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="alert"
        >
          {props.selectionError}
        </p>
      ) : null}
    </section>
  );
}

export function FirmProvisioningCard(props: {
  mode?: "create" | "details";
  firm?: Firm | null;
  brainConfig?: FirmBrainConfig | null;
  selectionError?: string | null;
  onCreated?: (firm: Firm) => void;
} = {}) {
  const [createdFirm, setCreatedFirm] = useState<Firm | null>(null);
  const mode = props.mode ?? "create";
  const firm = props.firm ?? createdFirm;

  if (mode === "details") {
    if (!firm) {
      return <FirmSelectionEmptyState selectionError={props.selectionError ?? null} />;
    }

    return <FirmWorkspaceCard firm={firm} brainConfig={props.brainConfig ?? null} />;
  }

  if (firm) {
    return <FirmWorkspaceCard firm={firm} brainConfig={null} />;
  }

  return (
    <TenantCreationCard
      onCreated={(nextFirm) => {
        setCreatedFirm(nextFirm);
        props.onCreated?.(nextFirm);
      }}
    />
  );
}
