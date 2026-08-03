export function sendFormDataWithProgress<T>(params: {
  url: string;
  method: "POST" | "PATCH";
  body: FormData;
  onProgress?: (value: number) => void;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open(params.method, params.url);
    request.responseType = "json";

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;

      params.onProgress?.((event.loaded / event.total) * 100);
    });

    request.addEventListener("load", () => {
      const result =
        request.response ?? safeParse(request.responseText);

      if (request.status >= 200 && request.status < 300) {
        params.onProgress?.(100);
        resolve(result as T);
        return;
      }

      reject(
        new Error(
          getErrorMessage(result) ||
            "Požadavek se nepodařilo dokončit",
        ),
      );
    });

    request.addEventListener("error", () => {
      reject(new Error("Síťové připojení bylo přerušeno"));
    });

    request.addEventListener("abort", () => {
      reject(new Error("Nahrávání bylo zrušeno"));
    });

    request.send(params.body);
  });
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getErrorMessage(value: unknown): string {
  if (!value || typeof value !== "object") return "";

  const error = (value as { error?: unknown }).error;

  return typeof error === "string" ? error : "";
}