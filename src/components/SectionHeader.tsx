interface SectionHeaderProps {
  title: string;
  logoUrl?: string;
  logoAlt?: string;
}

export default function SectionHeader({ title, logoUrl, logoAlt }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {logoUrl && (
        <img
          src={logoUrl}
          alt={logoAlt || `${title} logo`}
          className="w-7 h-7 object-contain"
        />
      )}
      <h3 className="text-apple-title2 font-semibold text-apple-text tracking-tight">
        {title}
      </h3>
    </div>
  );
}
