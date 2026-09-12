interface PlaceholderSectionProps {
  title: string;
  description: string;
}

export default function PlaceholderSection({ title, description }: PlaceholderSectionProps) {
  return (
    <div className="placeholder-section">
      <div className="placeholder-card">
        <h2>{title}</h2>
        <p>{description}</p>
        <span className="placeholder-tag">Not yet implemented</span>
      </div>
    </div>
  );
}
