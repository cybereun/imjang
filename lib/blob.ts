import { del, put } from "@vercel/blob";

/**
 * 사진·음성 녹음 파일 저장소.
 *
 * 호스티드 버전은 blobKey를 저장하고 만료형 서명 URL을 발급했지만,
 * Vercel Blob은 put()이 공개 URL을 바로 반환하므로 그 URL을
 * 기존 blobKey 컬럼에 그대로 저장합니다. (컬럼명 유지, 값은 URL)
 * 삭제는 del(url)로 처리합니다.
 */
export async function putBlob(
  pathname: string,
  body: Uint8Array,
  contentType: string,
): Promise<string> {
  // @vercel/blob의 put body 타입과 맞추기 위해 Blob으로 감싼다.
  const blob = await put(pathname, new Blob([body as BlobPart], { type: contentType }), {
    access: "public",
    contentType,
  });
  return blob.url;
}

export async function deleteBlob(url: string): Promise<void> {
  if (!url) return;
  await del(url).catch(() => undefined);
}
