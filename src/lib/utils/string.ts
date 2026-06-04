export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export const randomString = (
  nb: number,
  {
    numbers = true,
    lowers = true,
    uppers = false,
    specials = false,
  }: { numbers?: boolean; lowers?: boolean; uppers?: boolean; specials?: boolean } = {},
) => {
  let chars = '';
  if (numbers) chars += '0123456789';
  if (lowers) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (uppers) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (specials) chars += '!@#$%^&*()_+~`|}{[]:;?><,./-=';
  return [...Array(nb)].map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
};
