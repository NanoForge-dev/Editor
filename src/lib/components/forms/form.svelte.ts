import type { ZodType } from 'zod';

export type FormErrors<T extends object> = {
  [K in keyof T]?: string;
};

export const useForm = <T extends object>(
  config: {
    defaultValues?: Partial<T>;
    schema?: ZodType<T>;
    onSubmit?: (values: T) => void | Promise<void>;
  } = {},
) => {
  const values = $state<T>({ ...(config.defaultValues ?? {}) } as T);
  let errors = $state<FormErrors<T>>({});
  let isSubmitting = $state(false);

  function handleChange(event: Event): void {
    const el = event.target as HTMLInputElement;
    const field = el.name as keyof T;
    (values as any)[field] = el.type === 'checkbox' ? el.checked : el.value;
  }

  const handleSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();

    if (config.schema) {
      const result = config.schema.safeParse(values);
      errors = {} as FormErrors<T>;
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = issue.path[0] as keyof T;
          if (key && !(errors as any)[key]) (errors as any)[key] = issue.message;
        }
        return;
      }
    }

    isSubmitting = true;
    try {
      await config.onSubmit?.(values);
    } finally {
      isSubmitting = false;
    }
  };

  const reset = (): void => {
    Object.assign(values, { ...(config.defaultValues ?? {}) });
    errors = {} as FormErrors<T>;
  };

  return {
    get values() {
      return values;
    },
    get errors() {
      return errors;
    },
    get isSubmitting() {
      return isSubmitting;
    },
    handleChange,
    handleSubmit,
    reset,
  };
};

export type FormInstance<T extends object = any> = ReturnType<typeof useForm<T>>;
