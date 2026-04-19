import Image from "next/image";

type BrandLogoMarkProps = {
  className?: string;
  /** Passed to next/image width/height for layout hint */
  size?: number;
};

export function BrandLogoMark({ className, size = 48 }: BrandLogoMarkProps) {
  return (
    <Image
      src="/logo.png"
      alt="GradApply"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
