export default function removeFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}
