/**
 * User Signup Request Interface
 */
export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * User Login Request Interface
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * User Response Interface
 */
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'inactive';
  created_at: string;
}

/**
 * Authentication Response Interface
 */
export interface AuthResponse {
  message: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  token: string;
}

/**
 * API Error Response Interface
 */
export interface ErrorResponse {
  error: string;
}
