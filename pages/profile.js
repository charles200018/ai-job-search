import { useState } from 'react'
import { useAuth } from '../src/context/AuthContext.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']

function MatchCard({ job }) {
  return (
    <article className="rounded-[26px] border border-stone-200 bg-white/90 p-6 shadow-[0_24px_80px_rgba(28,25,23,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">Resume Match</p>
          <a href={`/jobs/${encodeURIComponent(job.id)}`} className="mt-2 block text-2xl font-semibold text-stone-950 hover:text-orange-700">
            {job.title}
          </a>
          <p className="mt-1 text-sm text-stone-600">{job.company} · {job.location} · {job.remoteType}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(job.skills || []).slice(0, 8).map(skill => (
              <span key={skill} className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-w-[220px] flex-col gap-3 lg:items-end">
          <p className="text-sm font-semibold text-stone-900">{Math.round((job.resumeSimilarity || 0) * 100)}% similarity</p>
          <p className="text-sm text-stone-500">{job.salary || 'Compensation not listed'}</p>
          <a
            href={job.applyUrl || '#'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Apply on Company Website
          </a>
        </div>
      </div>
    </article>
  )
}

export default function Profile() {
  const { user, authError, loginWithGoogle, logout, getCurrentIdToken } = useAuth()
  const [file, setFile] = useState(null)
  const [message, setMessage] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [matches, setMatches] = useState([])
  const [resumePreview, setResumePreview] = useState('')

  function validateFile(candidateFile) {
    if (!candidateFile) return 'Choose a file'
    if (candidateFile.size > MAX_FILE_SIZE) return 'Resume file must be under 5MB'
    const lower = candidateFile.name.toLowerCase()
    const isAllowed = ALLOWED_EXTENSIONS.some(ext => lower.endsWith(ext))
    if (!isAllowed) return 'Supported formats: PDF, JPG, PNG.'
    return null
  }

  const fileValidationMessage = file ? validateFile(file) : ''
  const uploadBlockedReason = !user
    ? 'Sign in with Google before uploading your resume.'
    : fileValidationMessage

  async function upload() {
    if (!user) {
      setMessage('Please sign in with Google before uploading your resume.')
      return
    }

    const fileValidation = validateFile(file)
    if (fileValidation) {
      setMessage(fileValidation)
      return
    }

    setIsUploading(true)
    setMessage('Extracting resume and matching jobs...')

    try {
      const formData = new FormData()
      formData.append('resume', file)

      const token = await getCurrentIdToken()
      if (!token) {
        throw new Error('Please sign in with Google before uploading your resume.')
      }

      const res = await fetch('/api/uploadResume', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to process resume')
      setMatches(payload.matches || [])
      setResumePreview(payload.extractedTextPreview || '')
      setMessage(payload.message || 'Resume processed successfully')
    } catch (error) {
      setMessage(error.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-x-0 top-[-160px] h-[360px] bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.26),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.18),_transparent_35%)]" />
      <main className="relative mx-auto max-w-6xl space-y-8">
        <header className="rounded-[32px] border border-stone-200 bg-white/85 p-8 shadow-[0_30px_120px_rgba(28,25,23,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a href="/" className="text-sm font-semibold text-teal-700 hover:text-orange-700">Back to search</a>
            {user ? (
              <button
                onClick={logout}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-orange-400 hover:text-orange-700"
              >
                Sign out ({user.displayName || user.email || 'User'})
              </button>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-orange-400 hover:text-orange-700"
              >
                Sign in with Google
              </button>
            )}
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">Resume Matching</p>
          <h1 className="mt-3 text-5xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            Upload your resume and rank the best-fit jobs instantly.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600">
            Upload a resume our AI can read. Supported formats: PDF, JPG, PNG.
            Images must contain clear printed text. Blurry or handwritten resumes may fail to process.
            For best results, upload a PDF resume.
          </p>
        </header>

        <section className="grid gap-8 lg:grid-cols-[380px,minmax(0,1fr)]">
          <div className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-[0_24px_80px_rgba(28,25,23,0.08)]">
            {authError ? <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{authError}</p> : null}
            {!user ? <p className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">Sign in with Google to upload and process your resume.</p> : null}

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center transition hover:border-orange-400 hover:bg-orange-50/40">
              <span className="text-sm font-semibold uppercase tracking-[0.28em] text-stone-500">PDF, JPG, PNG</span>
              <span className="mt-3 text-2xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                {file ? file.name : 'Choose your resume'}
              </span>
              <span className="mt-3 text-sm leading-7 text-stone-500">Maximum file size: 5MB</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={event => setFile(event.target.files?.[0] || null)}
                className="hidden"
              />
            </label>

            <button
              onClick={upload}
              disabled={isUploading}
              className="mt-5 w-full rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? 'Matching jobs...' : 'Find matching jobs'}
            </button>

            {uploadBlockedReason ? (
              <p className="mt-3 text-sm text-orange-700">{uploadBlockedReason}</p>
            ) : null}

            {message ? <p className="mt-4 text-sm leading-7 text-stone-600">{message}</p> : null}

            {resumePreview ? (
              <div className="mt-6 rounded-[20px] border border-teal-200 bg-teal-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Extracted Resume Preview</p>
                <p className="mt-3 text-sm leading-7 text-teal-900">{resumePreview}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] border border-stone-200 bg-white/80 px-6 py-4 shadow-[0_20px_60px_rgba(28,25,23,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">Top 10 Matches</p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                {matches.length > 0 ? `${matches.length} ranked opportunities` : 'No resume processed yet'}
              </h2>
            </div>

            {matches.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/75 p-10 text-center shadow-[0_20px_60px_rgba(28,25,23,0.05)]">
                <h3 className="text-2xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Your matches will appear here</h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">Upload a resume to compare it against the embedded job database.</p>
              </div>
            ) : null}

            {matches.map(job => (
              <MatchCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
