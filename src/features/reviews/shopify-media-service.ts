import type pg from "pg";
import type { Env } from "../../types";

type ShopifyGraphqlError = { message?: string };
type StagedTarget = { url: string; resourceUrl: string; parameters: Array<{ name: string; value: string }> };
type ShopifyFile = { id: string; fileStatus?: string; image?: { url?: string | null } | null; sources?: Array<{ url?: string | null }> | null; url?: string | null };

export type ShopifyMediaReference = { shopifyFileId: string | null; shopDomain: string; accessToken: string | null };

async function shopifyGraphql<T>(env: Env, shopDomain: string, accessToken: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(`https://${shopDomain}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-shopify-access-token": accessToken },
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json().catch(() => ({})) as { data?: T; errors?: ShopifyGraphqlError[] };
  if (!response.ok || result.errors?.length || !result.data) {
    throw new Error(result.errors?.map((error) => error.message).filter(Boolean).join("; ") || `Shopify Files request failed (${response.status})`);
  }
  return result.data;
}

function fileUrl(file: ShopifyFile) {
  return file.image?.url ?? file.sources?.find((source) => source.url)?.url ?? file.url ?? null;
}

export async function uploadReviewMediaToShopifyFiles(env: Env, input: {
  shopDomain: string; accessToken: string; requestId: string; file: File; kind: "image" | "video";
}) {
  const staged = await shopifyGraphql<{ stagedUploadsCreate: { stagedTargets: StagedTarget[]; userErrors: Array<{ message: string }> } }>(env, input.shopDomain, input.accessToken, `
    mutation StageReviewMedia($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { message }
      }
    }`, {
    input: [{ filename: input.file.name, mimeType: input.file.type, httpMethod: "POST", resource: input.kind === "video" ? "VIDEO" : "IMAGE", fileSize: String(input.file.size) }],
  });
  const stageResult = staged.stagedUploadsCreate;
  if (stageResult.userErrors.length || !stageResult.stagedTargets[0]) throw new Error(stageResult.userErrors.map((error) => error.message).join("; ") || "Shopify could not prepare this file.");
  const target = stageResult.stagedTargets[0];
  const body = new FormData();
  for (const parameter of target.parameters) body.set(parameter.name, parameter.value);
  body.set("file", input.file, input.file.name);
  const upload = await fetch(target.url, { method: "POST", body });
  if (!upload.ok) throw new Error("Shopify could not receive this file.");

  const created = await shopifyGraphql<{ fileCreate: { files: ShopifyFile[]; userErrors: Array<{ message: string }> } }>(env, input.shopDomain, input.accessToken, `
    mutation CreateReviewMedia($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id fileStatus
          ... on MediaImage { image { url } }
          ... on Video { sources { url } }
          ... on GenericFile { url }
        }
        userErrors { message }
      }
    }`, {
    files: [{ alt: `Trust Me Review upload for invitation ${input.requestId}`, contentType: input.kind === "video" ? "VIDEO" : "IMAGE", originalSource: target.resourceUrl }],
  });
  const createResult = created.fileCreate;
  if (createResult.userErrors.length || !createResult.files[0]) throw new Error(createResult.userErrors.map((error) => error.message).join("; ") || "Shopify could not create this file.");
  const file = createResult.files[0];
  return { shopifyFileId: file.id, fileStatus: file.fileStatus ?? "UPLOADED", storageUrl: fileUrl(file) };
}

export async function resolveShopifyMediaUrl(env: Env, shopDomain: string, accessToken: string, shopifyFileId: string) {
  const result = await shopifyGraphql<{ node: ShopifyFile | null }>(env, shopDomain, accessToken, `
    query ReviewMediaFile($id: ID!) {
      node(id: $id) {
        id
        ... on MediaImage { fileStatus image { url } }
        ... on Video { fileStatus sources { url } }
        ... on GenericFile { fileStatus url }
      }
    }`, { id: shopifyFileId });
  if (!result.node) return null;
  return { storageUrl: fileUrl(result.node), fileStatus: result.node.fileStatus ?? "UPLOADED" };
}

export async function deleteShopifyReviewMedia(env: Env, shopDomain: string, accessToken: string | null, fileIds: readonly (string | null)[]) {
  const ids = [...new Set(fileIds.filter((id): id is string => Boolean(id)))];
  if (!accessToken || !ids.length) return;
  const result = await shopifyGraphql<{ fileDelete: { deletedFileIds: string[]; userErrors: Array<{ message: string }> } }>(env, shopDomain, accessToken, `
    mutation DeleteReviewMedia($fileIds: [ID!]!) { fileDelete(fileIds: $fileIds) { deletedFileIds userErrors { message } } }
  `, { fileIds: ids });
  if (result.fileDelete.userErrors.length) throw new Error(result.fileDelete.userErrors.map((error) => error.message).join("; "));
}

export async function removeExpiredReviewMedia(client: pg.Client, env: Env) {
  const expired = await client.query<{ id: string; shopify_file_id: string | null; domain: string; access_token: string | null }>(`
    select rm.id,rm.shopify_file_id,s.domain,s.access_token from review_media rm
    join shops s on s.id=rm.shop_id
    where rm.review_id is null and rm.created_at < now() - interval '24 hours'
    order by rm.created_at asc limit 100`);
  for (const media of expired.rows) {
    try { await deleteShopifyReviewMedia(env, media.domain, media.access_token, [media.shopify_file_id]); }
    catch (error) { console.error("review_media_expiry_delete_failed", { mediaId: media.id, error: error instanceof Error ? error.message : String(error) }); continue; }
    await client.query("delete from review_media where id=$1 and review_id is null", [media.id]);
  }
  return expired.rows.length;
}
