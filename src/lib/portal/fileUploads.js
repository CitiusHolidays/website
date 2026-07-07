const MAX_QUERY_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export async function uploadQueryFiles({ queryId, files, generateUploadUrl, attachQueryFile }) {
  await Promise.all(
    files.map(async (file) => {
      if (file.size > MAX_QUERY_ATTACHMENT_BYTES) {
        throw new Error(`${file.name} exceeds the 15 MB limit.`);
      }
      const uploadUrl = await generateUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
        method: "POST",
      });
      if (!uploadRes.ok) {
        throw new Error(`Failed to upload ${file.name}.`);
      }
      const { storageId } = await uploadRes.json();
      await attachQueryFile({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        queryId,
        storageId,
      });
    })
  );
}

export async function uploadEntityFiles({
  entityId,
  idField,
  files,
  generateUploadUrl,
  attachFile,
}) {
  await Promise.all(
    files.map(async (file) => {
      if (file.size > MAX_QUERY_ATTACHMENT_BYTES) {
        throw new Error(`${file.name} exceeds the 15 MB limit.`);
      }
      const uploadUrl = await generateUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
        method: "POST",
      });
      if (!uploadRes.ok) {
        throw new Error(`Failed to upload ${file.name}.`);
      }
      const { storageId } = await uploadRes.json();
      await attachFile({
        [idField]: entityId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        storageId,
      });
    })
  );
}

export async function uploadExpenseProofFiles({
  expenseId,
  files,
  generateUploadUrl,
  attachExpenseProof,
}) {
  await uploadEntityFiles({
    attachFile: attachExpenseProof,
    entityId: expenseId,
    files,
    generateUploadUrl,
    idField: "expenseId",
  });
}
