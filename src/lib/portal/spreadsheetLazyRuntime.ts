export function createLazyModuleLoader<Module>(
  importer: () => Promise<Module>
): () => Promise<Module> {
  let pending: Promise<Module> | null = null;
  return () => {
    pending ??= importer();
    return pending;
  };
}

export const loadSpreadsheetImportRuntime = createLazyModuleLoader(
  () => import("./spreadsheetImports")
);
export const loadSpreadsheetExportRuntime = createLazyModuleLoader(
  () => import("./spreadsheetExports")
);
