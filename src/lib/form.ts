export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const enc = (s: string) => encodeURIComponent(s);
