/**
 * Utility to crop images client-side using HTML5 Canvas
 */

export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    // Do not set crossOrigin for data: or blob: URLs as it can taint canvas in some browsers
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      image.setAttribute('crossOrigin', 'anonymous')
    }
    image.src = url
  })
}

/**
 * Given an image source URL and pixel crop coordinates from react-easy-crop,
 * draws the cropped area onto a Canvas and returns a JPEG Blob/File.
 *
 * react-easy-crop's pixelCrop parameter already includes all zoom and positioning adjustments
 * relative to the image's natural pixel dimensions. No additional zoom calculations are applied.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop,
  fileName: string = 'cropped-image.jpg'
): Promise<File> {
  const image = await createImage(imageSrc)

  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height

  if (!naturalWidth || !naturalHeight) {
    throw new Error('Não foi possível obter as dimensões da imagem.')
  }

  // Ensure source pixelCrop coordinates stay strictly within valid image natural bounds
  const sourceX = Math.max(0, Math.min(pixelCrop.x, naturalWidth - 1))
  const sourceY = Math.max(0, Math.min(pixelCrop.y, naturalHeight - 1))
  const sourceWidth = Math.max(1, Math.min(pixelCrop.width, naturalWidth - sourceX))
  const sourceHeight = Math.max(1, Math.min(pixelCrop.height, naturalHeight - sourceY))

  // Output canvas dimensions match pixelCrop dimensions exactly (rounded to integers)
  const targetWidth = Math.max(1, Math.round(sourceWidth))
  const targetHeight = Math.max(1, Math.round(sourceHeight))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Não foi possível obter contexto 2D do Canvas.')
  }

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Draw exact crop region onto canvas (exact 9-argument form)
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Erro ao gerar blob da imagem recortada.'))
          return
        }
        const file = new File([blob], fileName, { type: 'image/jpeg' })
        resolve(file)
      },
      'image/jpeg',
      0.92
    )
  })
}
