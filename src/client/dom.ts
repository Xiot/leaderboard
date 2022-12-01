export function element(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

export function text(value: string | number) {
  return document.createTextNode(String(value));
}

export type NodeProps = {
  class?: string;
  style?: string | unknown;
  onclick?: () => void;
};

export function node(tag: string, props: NodeProps, children?: NodeChildren) {
  const el = document.createElement(tag);
  props &&
    Object.entries(props).forEach(([key, value]) => {
      if (key.startsWith('on')) {
        // @ts-ignore
        el[key] = value;
      } else if (key === 'style' && typeof value !== 'string') {
        // @ts-ignore
        Object.entries(value).forEach(
          ([key, value]) =>
            // @ts-ignore
            (el.style[key] = value),
        );
      } else {
        el.setAttribute(key, value as string);
      }
    });
  children && append(el, children);
  return el;
}

export type NodeChildren = string | Node | Text | Node[];
export function div(props: NodeProps, children?: NodeChildren) {
  return node('div', props, children);
}

export function append(target: HTMLElement, children?: NodeChildren) {
  if (!children) return;
  if (typeof children === 'string') target.appendChild(text(children));
  else if (Array.isArray(children)) children.forEach(c => target.appendChild(c));
  else target.appendChild(children);
}
