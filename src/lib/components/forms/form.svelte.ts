import { type SuperForm, defaults, superForm } from 'sveltekit-superforms';
import { zod4, zodClient } from 'sveltekit-superforms/adapters';
import type { ZodType } from 'zod';

export const useForm = <T extends Record<string, unknown>>(config: {
  schema: ZodType<T>;
  defaultValues?: Partial<T>;
  onSubmit?: (values: T) => void | Promise<void>;
}): SuperForm<T> => {
  const result = superForm(defaults(zod4(config.schema as any)), {
    SPA: true,
    validators: zodClient(config.schema as any),
    resetForm: false,
    onUpdate: async ({ form: f }) => {
      console.log(f.data);
      if (f.valid) {
        await config.onSubmit?.(f.data as T);
      }
    },
  });

  if (config.defaultValues) {
    result.form.update((v) => ({ ...v, ...config.defaultValues }));
  }

  return result as unknown as SuperForm<T>;
};

export type FormInstance = SuperForm<any>;
