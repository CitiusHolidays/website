export function commercialFileUrl(fileId: string) {
  return `/api/portal/files/commercial/${encodeURIComponent(fileId)}`;
}
