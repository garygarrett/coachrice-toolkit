// Shrinks a picture in the browser before upload (max 1600px wide) so it stays small and loads fast.
// PNGs stay PNG (screenshots stay sharp); everything else becomes JPEG. GIFs are sent as they are.
export async function prepareImage(file, { maxWidth = 1600, maxBytes = 2.5 * 1024 * 1024 } = {}) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Please choose a PNG, JPG, WEBP, or GIF picture.')
  const toBase64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new Error('Could not read that picture.'))
    r.readAsDataURL(blob)
  })
  if (file.type === 'image/gif') {
    if (file.size > maxBytes) throw new Error('That GIF is too large (2.5 MB maximum).')
    return { type: file.type, data: await toBase64(file) }
  }
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (file.type !== 'image/png') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blobOf = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q))
  let type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  let blob = await blobOf(type, 0.85)
  if (blob.size > maxBytes) { type = 'image/jpeg'; ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); blob = await blobOf(type, 0.75) }
  if (blob.size > maxBytes) throw new Error('That picture is still too large after shrinking. Try a smaller one.')
  return { type, data: await toBase64(blob) }
}
