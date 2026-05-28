import { BlobNotFoundError, get, put } from "@vercel/blob";

const DATA_PATH = "changhe-litigation-workbench/case-data.json";
const MAX_BODY_BYTES = 1024 * 1024;

export default async function handler(req, res) {
  setNoStore(res);

  if (!["GET", "PUT"].includes(req.method)) {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({
      error: "BLOB_NOT_CONFIGURED",
      message: "Vercel Blob 尚未配置。请在项目里创建 Blob Store，并设置 BLOB_READ_WRITE_TOKEN。",
    });
  }

  try {
    if (req.method === "GET") {
      return await handleGet(res);
    }
    return await handlePut(req, res);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "SERVER_ERROR", message: "云端资料读写失败。" });
  }
}

async function handleGet(res) {
  try {
    const blob = await get(DATA_PATH, { access: "private", useCache: false });
    if (!blob) {
      return res.status(200).json({ data: null, updatedAt: null });
    }

    const dataText = await streamToText(blob.stream);
    return res.status(200).json({
      data: JSON.parse(dataText),
      etag: blob.blob.etag,
      updatedAt: blob.blob.uploadedAt,
    });
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return res.status(200).json({ data: null, updatedAt: null });
    }
    throw error;
  }
}

async function handlePut(req, res) {
  const body = await readJsonBody(req);
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    data: sanitizeState(body?.data),
  };

  const blob = await put(DATA_PATH, JSON.stringify(payload, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60,
  });

  return res.status(200).json({
    ok: true,
    pathname: blob.pathname,
    updatedAt: payload.savedAt,
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = "";

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      raw += chunk;
    });

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}

async function streamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

function sanitizeState(value) {
  if (!value || typeof value !== "object") return {};
  return JSON.parse(JSON.stringify(value));
}

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
}
