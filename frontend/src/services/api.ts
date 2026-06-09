import axios from "axios";

// Instância do Axios pré-configurada
// Você pode alterar a baseURL no arquivo .env configurando VITE_API_URL
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3333",
  headers: {
    "Content-Type": "application/json",
  },
});

// Tipagens para requisições de autenticação
export interface LoginRequest {
  email: string;
  password?: string; // senha opcional caso usem outro método futuramente
}

export interface RegisterRequest {
  name: string;
  email: string;
  password?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
  };
  token?: string;
}

// Funções prontas para chamada das rotas do backend
export const authService = {
  login: async (data: LoginRequest) => {
    // Rota padrão '/login' ou '/auth/login'. O backend deve retornar HTTP 200.
    const response = await api.post<AuthResponse>("/login", data);
    return response.data;
  },

  register: async (data: RegisterRequest) => {
    // Rota padrão '/register' ou '/auth/register'. O backend deve retornar HTTP 200/201.
    const response = await api.post<AuthResponse>("/register", data);
    return response.data;
  },
};
