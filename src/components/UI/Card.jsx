import React from 'react';

/**
 * StudySync Card Component
 */
export function Card({
  children,
  className = '',
  interactive = false,
  id,
  onClick,
  ...rest
}) {
  const interactiveClass = interactive ? 'card-interactive' : '';

  return (
    <div
      id={id}
      className={`card ${interactiveClass} ${className}`.trim()}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`card-header ${className}`.trim()}>
      <div>
        {title && <h3 className="card-title">{title}</h3>}
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return <div className={`card-footer ${className}`.trim()}>{children}</div>;
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
