import { readFile } from 'node:fs/promises'
import formidable from 'formidable'
import pdfParse from 'pdf-parse'
import Tesseract from 'tesseract.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']

function normalizeExtension(fileName = '') {
  const lower = String(fileName).toLowerCase()
  return ALLOWED_EXTENSIONS.find(extension => lower.endsWith(extension)) || ''
}

export function parseMultipartForm(req) {
  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: MAX_FILE_SIZE,
    filter: ({ originalFilename }) => Boolean(normalizeExtension(originalFilename))
  })

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error)
        return
      }

      const selected = files.resume
      const file = Array.isArray(selected) ? selected[0] : selected
      resolve({ fields, file })
    })
  })
}

export async function extractResumeText(file) {
  if (!file) {
    throw new Error('Missing resume file')
  }

  const extension = normalizeExtension(file.originalFilename)
  if (!extension) {
    throw new Error('Only PDF, JPG, and PNG files are allowed')
  }

  const buffer = await readFile(file.filepath)
  if (extension === '.pdf') {
    const parsed = await pdfParse(buffer)
    return parsed.text || ''
  }

  // Image formats: run OCR with Tesseract
  if (extension === '.jpg' || extension === '.jpeg' || extension === '.png') {
    const result = await Tesseract.recognize(buffer, 'eng')
    const text = result?.data?.text || ''
    if (!text.trim()) {
      throw new Error('Unable to read text from image resume. Please upload a clearer image or a PDF resume.')
    }
    return text
  }

  throw new Error('Unsupported resume format')
}