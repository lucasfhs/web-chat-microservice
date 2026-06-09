import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export function LottieAnimation({ src }: { src: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <DotLottieReact
        src={src}
        loop
        autoplay
        className="w-full h-full object-contain"
        speed={0.6}
      />
    </div>
  );
}