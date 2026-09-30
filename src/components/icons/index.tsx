import type { SVGProps } from 'react'

/**
 * Icons in the Phosphor idiom the design system asks for: a 256 viewBox and
 * `currentColor`, so they take the colour of the button they sit in. Only the
 * handful the interface needs, written out — a package for six glyphs would be
 * a dependency with nothing to justify it.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Send. The system's own arrow, turned to point up. */
export function ArrowUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <g transform="rotate(-90 128 128)">
        <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
      </g>
    </Icon>
  )
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="72" y="72" width="112" height="112" rx="12" />
    </Icon>
  )
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <g transform="rotate(90 128 128)">
        <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
      </g>
    </Icon>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
    </Icon>
  )
}

export function WarningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z" />
    </Icon>
  )
}

export function RetryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64.53-22.4-80-39.85V208a8,8,0,0,1-16,0V164a8,8,0,0,1,8-8H84a8,8,0,0,1,0,16H55.77C67.35,188.5,90.89,208,128,208c36,0,58.14-21.46,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V71.85C192.53,54.4,165.39,32,128,32,85.18,32,59.42,57.27,58.34,58.34a8,8,0,0,0,11.3,11.34C69.86,69.46,92,48,128,48c37.11,0,60.65,19.5,72.23,36H172a8,8,0,0,0,0,16h44a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z" />
    </Icon>
  )
}
