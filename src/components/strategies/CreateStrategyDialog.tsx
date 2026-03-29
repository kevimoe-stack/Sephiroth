import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateStrategy, useParseStrategy } from "@/hooks/use-trading-data";

const schema = z.object({
  name: z.string().min(2),
  symbol: z.string().min(2),
  timeframe: z.string().min(1),
  description: z.string().optional(),
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreateStrategyDialog() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const createStrategy = useCreateStrategy();
  const parseStrategy = useParseStrategy();
  const { register, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { timeframe: "4h" },
  });

  const onSubmit = handleSubmit(async (values) => {
    await createStrategy.mutateAsync({
      ...values,
      status: "draft",
      is_champion: false,
      asset_class: "crypto",
      tags: values.tags?.split(",").map((tag) => tag.trim()).filter(Boolean),
    });
    reset();
    setOpen(false);
  });

  const handleParse = async () => {
    if (!prompt.trim()) return;
    try {
      const result = await parseStrategy.mutateAsync(prompt);
      const strategy = result.strategy;
      reset({
        name: strategy.name ?? "",
        symbol: strategy.symbol ?? "",
        timeframe: strategy.timeframe ?? "4h",
        description: strategy.description ?? "",
        tags: Array.isArray(strategy.tags) ? strategy.tags.join(", ") : "",
      });
      toast.success("Strategie-Entwurf aus Prompt erzeugt.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Parsing fehlgeschlagen.");
    }
  };

  if (!open) return <Button onClick={() => setOpen(true)}>Strategie erstellen</Button>;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle>Neue Strategie</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 rounded-xl bg-muted/50 p-4">
          <Textarea
            placeholder="Strategie als Freitext, z.B. 'BTCUSDT RSI mean reversion auf 1h mit Fokus auf ruhige Seitwaertsphasen'"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => void handleParse()} disabled={parseStrategy.isPending}>
              {parseStrategy.isPending ? "Analysiere..." : "Aus Prompt vorbefuellen"}
            </Button>
          </div>
        </div>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <Input placeholder="Name" {...register("name")} />
          <div className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Symbol" {...register("symbol")} />
            <Input placeholder="Timeframe" {...register("timeframe")} />
          </div>
          <Textarea placeholder="Beschreibung" {...register("description")} />
          <Input placeholder="Tags, komma-getrennt" {...register("tags")} />
          <div className="flex gap-3">
            <Button type="submit" disabled={createStrategy.isPending}>Speichern</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
