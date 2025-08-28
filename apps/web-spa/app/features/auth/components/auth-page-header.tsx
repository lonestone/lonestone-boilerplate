import React from 'react'

interface AuthPageHeaderProps {
  title: string
  description: string
}

export const AuthPageHeader: React.FC<AuthPageHeaderProps> = ({ title, description }) => (
  <div className="mb-6 space-y-4">
    <h1 className="text-5xl font-medium">{title}</h1>
    <p className="text-xl text-muted-foreground">{description}</p>
  </div>
)
