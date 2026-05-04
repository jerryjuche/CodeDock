export function toastInfo(message: string) {
  if (typeof window !== "undefined") {
    window.alert(message);
  }
}
