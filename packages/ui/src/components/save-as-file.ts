/** Hands the browser a file to save (its download), as `name`. */
export const saveAsFile = (name: string, content: string | Blob, type = 'text/plain'): void => {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
