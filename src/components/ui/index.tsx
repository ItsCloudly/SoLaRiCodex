import { Component, JSX } from 'solid-js';

interface CardProps {
  children: JSX.Element;
  class?: string;
  onClick?: () => void;
  key?: string | number;
}

export const Card: Component<CardProps> = (props) => {
  return (
    <div class={`card ${props.class || ''}`} onClick={props.onClick}>
      {props.children}
    </div>
  );
};

interface CardHeaderProps {
  children: JSX.Element;
}

export const CardHeader: Component<CardHeaderProps> = (props) => {
  return (
    <div class="card-header">
      {props.children}
    </div>
  );
};

interface CardTitleProps {
  children: JSX.Element;
}

export const CardTitle: Component<CardTitleProps> = (props) => {
  return (
    <h3 class="card-title">
      {props.children}
    </h3>
  );
};

interface ButtonProps {
  children: JSX.Element;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  class?: string;
}

export const Button: Component<ButtonProps> = (props) => {
  const variantClass = () => {
    switch (props.variant) {
      case 'primary': return 'btn-primary';
      case 'secondary': return 'btn-secondary';
      case 'ghost': return 'btn-ghost';
      default: return '';
    }
  };

  const sizeClass = () => {
    switch (props.size) {
      case 'sm': return 'btn-sm';
      case 'lg': return 'btn-lg';
      default: return '';
    }
  };

  return (
    <button
      type={props.type || 'button'}
      class={`btn ${variantClass()} ${sizeClass()} ${props.class || ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
};

interface BadgeProps {
  children: JSX.Element;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export const Badge: Component<BadgeProps> = (props) => {
  const variantClass = () => {
    switch (props.variant) {
      case 'success': return 'badge-success';
      case 'warning': return 'badge-warning';
      case 'error': return 'badge-error';
      case 'info': return 'badge-info';
      default: return '';
    }
  };

  return (
    <span class={`badge ${variantClass()}`}>
      {props.children}
    </span>
  );
};

interface ProgressProps {
  value: number;
  max?: number;
}

export const Progress: Component<ProgressProps> = (props) => {
  const percentage = () => {
    const max = props.max || 100;
    return Math.min(100, Math.max(0, (props.value / max) * 100));
  };

  return (
    <div class="progress">
      <div class="progress-bar" style={{ width: `${percentage()}%` }} />
    </div>
  );
};

interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onInput?: (value: string) => void;
  class?: string;
}

export const Input: Component<InputProps> = (props) => {
  return (
    <input
      type={props.type || 'text'}
      class={`input ${props.class || ''}`}
      placeholder={props.placeholder}
      value={props.value}
      onInput={(e) => props.onInput?.(e.currentTarget.value)}
    />
  );
};
