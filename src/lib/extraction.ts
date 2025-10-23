import { z } from "zod";
import type { ExtractionRecord, MicrobialEntity } from "@/types/extraction";

const entitySchema = z.object({
  genus: z.string().trim().optional().nullable(),
  species: z.string().trim().optional().nullable(),
  subspecies: z.string().trim().optional().nullable(),
  serovar: z.string().trim().optional().nullable(),
  strain: z.string().trim().optional().nullable(),
  mlst_st: z.string().trim().optional().nullable(),
  taxonomy_id: z.union([z.string(), z.number()]).optional().nullable(),
  source: z.string().trim().optional().nullable(),
  resistance: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .nullable(),
  pathogenicity: z.string().trim().optional().nullable(),
  context: z
    .object({
      snippet: z.string(),
    })
    .optional()
    .nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  note: z.string().optional().nullable(),
});

const extractionSchema = z.object({
  entities: z.array(entitySchema).default([]),
  summary: z
    .object({
      key_findings: z.array(z.string()).default([]),
    })
    .default({ key_findings: [] }),
});

export interface ExtractEntitiesParams {
  text: string;
  apiKey: string;
  model?: string;
}

export async function extractEntitiesFromText({
  text,
  apiKey,
  model = "deepseek/deepseek-chat",
}: ExtractEntitiesParams): Promise<MicrobialEntity[]> {
  const payload = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a biomedical information extraction model. Only respond with valid JSON that matches the required schema.",
      },
      {
        role: "user",
        content: `从以下文献内容中提取与微生物相关的信息，包括属、种、菌株编号、MLST、Taxonomy ID、分离来源、抗药性和致病性等。\n\n要求：\n1. 严格输出 JSON 格式，不要添加额外文本。\n2. JSON 结构：{\"entities\": [...]}。\n3. 每个实体字段：genus, species, subspecies, serovar, strain, mlst_st, taxonomy_id, source, resistance (数组), pathogenicity, context.snippet（提供该实体所在句子的前后 60 个字符），confidence（0-1 之间的小数）。\n4. 仅当信息明确出现时才填写字段，未知值使用 null。\n5. resistance 字段中只包含抗药性相关描述。\n\n文献内容：\n\n${text}`,
      },
    ],
    response_format: { type: "json_object" },
  } as const;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://micr-ai.local",
      "X-Title": "micr-AI 文献摘取",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`调用 DeepSeek API 失败：${response.status} ${message}`);
  }

  const json = await response.json();
  const contentRaw = json?.choices?.[0]?.message?.content;

  let content: unknown = {};
  if (typeof contentRaw === "string" && contentRaw.trim().length) {
    try {
      content = JSON.parse(contentRaw);
    } catch (error) {
      console.error("模型返回内容非 JSON：", contentRaw, error);
      throw new Error("AI 返回内容不是合法的 JSON。请重试或检查提示词。");
    }
  }

  const parsed = extractionSchema.safeParse(content);
  if (!parsed.success) {
    console.warn("无法解析模型返回的数据", parsed.error);
    throw new Error("AI 返回的数据格式无法识别，请重试。");
  }

  return parsed.data.entities.map((entity) => {
    const id = crypto.randomUUID();
    const resistanceSource = entity.resistance;
    const resistance = Array.isArray(resistanceSource)
      ? resistanceSource.filter(Boolean)
      : resistanceSource
      ? [resistanceSource].filter(Boolean)
      : [];

    return {
      id,
      genus: entity.genus ?? null,
      species: entity.species ?? null,
      subspecies: entity.subspecies ?? null,
      serovar: entity.serovar ?? null,
      strain: entity.strain ?? null,
      mlst_st: entity.mlst_st ?? null,
      taxonomy_id: entity.taxonomy_id
        ? String(entity.taxonomy_id)
        : null,
      source: entity.source ?? null,
      resistance,
      pathogenicity: entity.pathogenicity ?? null,
      context: entity.context?.snippet ?? null,
      confidence: entity.confidence ?? null,
    } satisfies MicrobialEntity;
  });
}

export function buildExtractionRecord(params: {
  fileName: string;
  fileSize: number;
  startedAt: number;
  finishedAt: number;
  entities: MicrobialEntity[];
  rawText: string;
}): ExtractionRecord {
  const { fileName, fileSize, startedAt, finishedAt, entities, rawText } = params;
  const organismCount = entities.length;
  const uniqueSpecies = new Set(
    entities
      .map((entity) =>
        [entity.genus, entity.species].filter(Boolean).join(" ") || null,
      )
      .filter(Boolean),
  ).size;

  const resistanceCount = entities.reduce(
    (acc, entity) => acc + (entity.resistance?.length ?? 0),
    0,
  );
  const sourceCount = entities.filter((entity) => entity.source).length;
  const pathogenicityCount = entities.filter((entity) => entity.pathogenicity)
    .length;

  return {
    id: crypto.randomUUID(),
    fileName,
    fileSize,
    processedAt: new Date(finishedAt).toISOString(),
    durationMs: finishedAt - startedAt,
    summary: {
      organismCount,
      uniqueSpecies,
      resistanceCount,
      sourceCount,
      pathogenicityCount,
      keyFindings: entities
        .slice(0, 5)
        .map((entity) =>
          [entity.genus, entity.species, entity.strain]
            .filter(Boolean)
            .join(" ") || "未命名实体",
        ),
    },
    entities,
    rawTextPreview: rawText.slice(0, 600),
  } satisfies ExtractionRecord;
}
