import { Helmet } from "react-helmet-async";

const BASE_URL = "https://spark-profit-ledger.lovable.app";

interface PageMetaProps {
  title: string;
  description?: string;
  path: string;
}

export default function PageMeta({ title, description, path }: PageMetaProps) {
  const url = `${BASE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
    </Helmet>
  );
}
