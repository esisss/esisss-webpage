import { useState } from "react";
import type { TranslateFn } from "../i18n/utils";

const RpgChat = ({ t }: { t?: TranslateFn }) => {
  const [action, setAction] = useState<"asking" | "answering">("asking")

  return (
    <section className="h-screen w-full bg-transparent flex flex-col justify-center items-center ">

    </section>
  );
};

export default RpgChat;
