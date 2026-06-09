import { CardLogin } from "@/components/ui/cardLogin";
import { LottieAnimation } from "@/components/ui/lottieAnimation";

import animation from "@/assets/lottie/plane-message-animation.lottie";

export function LoginPage() {
  return (
    <div className="h-full grid lg:grid-cols-2 items-center">
      <div className="hidden h-full p-6 lg:flex lg:flex-col items-center justify-center gap-12 bg-gray-950 text-white">
        <div className="space-y-4 max-w-xl">
          <h1 className="text-5xl font-bold leading-tight text-white">
            Comunicação rápida em tempo real.
          </h1>

          <p className="text-xl text-gray-300">
            Converse, compartilhe ideias e conecte-se
            com pessoas do mundo inteiro.
          </p>
        </div>
        <div className="w-[500px] h-[500px]">
          <LottieAnimation src={animation} />
        </div>
      </div>
      <div className="flex flex-col h-full items-center justify-center gap-20 p-6">
        <h1 className="text-5xl font-bold">ByteTalk</h1>
        <CardLogin />
      </div>
    </div>
  );
}