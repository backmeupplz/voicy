export default function augmentError(error: Error, augmentation: string) {
  error.message = `${augmentation}, ${error.message}`
  return error
}
