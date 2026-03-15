import { getFirestoreDb } from '../../src/lib/firebaseAdmin.js'
import { toIsoString } from '../../src/lib/jobSearch.js'

export async function getServerSideProps(context) {
  const jobId = String(context.params?.id || '')
  const db = getFirestoreDb()
  const snapshot = await db.collection('jobs').doc(jobId).get()

  if (!snapshot.exists) {
    return { notFound: true }
  }

  const data = snapshot.data()

  return {
    props: {
      job: {
        id: snapshot.id,
        ...data,
        scrapedAt: toIsoString(data.scrapedAt)
      }
    }
  }
}

export default function JobDetailsPage({ job }) {
  const applyLink = job?.applyUrl || null

  return (
    <div className="relative min-h-screen overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-x-0 top-[-160px] h-[360px] bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.22),_transparent_42%),radial-gradient(circle_at_right,_rgba(45,212,191,0.18),_transparent_35%)]" />
      <main className="relative mx-auto max-w-4xl rounded-[32px] border border-stone-200 bg-white/90 p-8 shadow-[0_30px_120px_rgba(28,25,23,0.08)] backdrop-blur">
        <a href="/" className="text-sm font-semibold text-teal-700 hover:text-orange-700">Back to search</a>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-orange-600">{job.remoteType || 'Flexible'}</p>
        <h1 className="mt-3 text-5xl font-semibold text-stone-950" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          {job.title || 'Untitled role'}
        </h1>
        <p className="mt-3 text-lg text-stone-600">{job.company || 'Unknown company'} · {job.location || 'Unspecified location'}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-700">{job.experienceLevel || 'Open level'}</span>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-700">{job.salary || 'Compensation not listed'}</span>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-700">Scraped {new Date(job.scrapedAt).toLocaleDateString()}</span>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-stone-950">Skills</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(job.skills || []).map(skill => (
              <span key={skill} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                {skill}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-stone-950">Description</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-stone-700">{job.description || 'No description available.'}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-stone-950">Apply</h2>
          {applyLink ? (
            <a
              href={applyLink}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Apply on Company Website
            </a>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No application link found for this job.</p>
          )}
        </section>
      </main>
    </div>
  )
}
