import Image from "next/image";

type Props = {
  /** Public path of the photo shown behind the purple overlay. */
  image?: string;
  alt?: string;
};

export function AuthRightPanel({ image = "/images/auth-carer-wheelchair.jpg", alt = "" }: Props) {
  return (
    <div className="relative hidden flex-1 items-center justify-center overflow-hidden lg:flex">
      <div className="absolute inset-0 gradient-hero" />
      <Image
        src={image}
        alt={alt}
        fill
        priority
        sizes="(min-width: 1024px) 400px, 0px"
        className="object-cover"
      />
      {/* Purple wash so the photo sits inside the brand palette. */}
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--hero-from))]/85 via-[hsl(var(--hero-mid))]/35 to-transparent" />
    </div>
  );
}
