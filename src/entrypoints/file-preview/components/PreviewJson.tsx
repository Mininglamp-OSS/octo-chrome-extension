import { JsonView, defaultStyles, darkStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { useEffect, useState } from "react";

interface Props {
  data: unknown;
}

export function PreviewJson({ data }: Props) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 text-sm">
      <JsonView
        data={data as object}
        shouldExpandNode={(level) => level < 2}
        style={dark ? darkStyles : defaultStyles}
      />
    </div>
  );
}
