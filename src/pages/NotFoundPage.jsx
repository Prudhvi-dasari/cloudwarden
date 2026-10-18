import PageFrame from '../components/PageFrame';

export default function NotFoundPage() {
  return (
    <PageFrame
      eyebrow="404"
      title="This page is gone."
      subtitle="The link may be wrong, or the transfer may have expired. Start a new send from the homepage."
      nextLabel="Send a file"
      nextTo="/"
    >
      <div className="custom-card p-6 max-w-md">
        <p className="text-sm text-white/55 leading-relaxed">
          If you expected a download here, ask the sender for a fresh link. Expired files are deleted on purpose.
        </p>
      </div>
    </PageFrame>
  );
}
