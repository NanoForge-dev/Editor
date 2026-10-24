import {
  type CodeService,
  CodeServiceToken,
  type DocumentService,
  DocumentServiceToken,
  type PluginContext,
} from '@nanoforge-dev/editor-sdk';

/** The code and document services, when the editor has them. */
export const codeServices = (
  context: PluginContext,
): { code?: CodeService; documents?: DocumentService } => {
  const services = context.services;
  return {
    code: services.tryGet(CodeServiceToken),
    documents: services.tryGet(DocumentServiceToken),
  };
};
