import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authService } from "@/services/api"

// Schema unificado com nome opcional (validado manualmente se for cadastro)
const authSchema = z.object({
  name: z.string().optional(),
  email: z
    .string()
    .min(1, "O email é obrigatório")
    .email("Insira um endereço de email válido"),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().optional(),
})

type FormData = z.infer<typeof authSchema>

export function CardLogin({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isRegister, setIsRegister] = useState(false)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  // Alterna o modo e limpa os campos e erros
  const handleToggleMode = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsRegister((prev) => !prev)
    reset()
  }

  const onSubmit = async (data: FormData) => {
    let hasError = false

    // Validação manual complementar para o nome em modo de cadastro
    if (isRegister) {
      if (!data.name || data.name.trim().length < 3) {
        setError("name", {
          type: "manual",
          message: "O nome deve ter pelo menos 3 caracteres",
        })
        hasError = true
      }
      if (!data.confirmPassword || data.confirmPassword.length < 6) {
        setError("confirmPassword", {
          type: "manual",
          message: "A confirmação da senha é obrigatória e deve ter pelo menos 6 caracteres",
        })
        hasError = true
      } else if (data.confirmPassword !== data.password) {
        setError("confirmPassword", {
          type: "manual",
          message: "As senhas não coincidem",
        })
        hasError = true
      }
    }

    if (hasError) return

    try {
      if (isRegister) {
        await authService.register({
          name: data.name || "",
          email: data.email,
          password: data.password,
        })
        toast.success("Cadastro realizado com sucesso!")
      } else {
        await authService.login({
          email: data.email,
          password: data.password,
        })
        toast.success("Login realizado com sucesso!")
      }
      // Redireciona o usuário para a página de salas
      navigate("/rooms")
    } catch (error: any) {
      console.error("Erro na autenticação:", error)
      const errorMsg =
        error.response?.data?.message ||
        "Ocorreu um erro inesperado. Verifique os dados fornecidos."
      toast.error(errorMsg)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-sm", className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-bold transition-all duration-300">
              {isRegister ? "Crie sua conta no ByteTalk" : "É hora de se Conectar"}
            </h1>
            <FieldDescription>
              {isRegister ? (
                <>
                  Já tem uma conta?{" "}
                  <a href="#" onClick={handleToggleMode} className="font-semibold text-primary underline">
                    Entre
                  </a>
                </>
              ) : (
                <>
                  Não tem uma conta?{" "}
                  <a href="#" onClick={handleToggleMode} className="font-semibold text-primary underline">
                    Crie uma
                  </a>
                </>
              )}
            </FieldDescription>
          </div>

          {isRegister && (
            <Field>
              <FieldLabel htmlFor="name">Nome</FieldLabel>
              <Input
                id="name"
                type="text"
                {...register("name")}
                aria-invalid={!!errors.name}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              {...register("email")}
              aria-invalid={!!errors.email}
            />
            {errors.email && <FieldError>{errors.email.message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <Input
              id="password"
              type="password"
              {...register("password")}
              aria-invalid={!!errors.password}
            />
            {errors.password && <FieldError>{errors.password.message}</FieldError>}
          </Field>

          {isRegister && (
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirmar Senha</FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                {...register("confirmPassword")}
                aria-invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && <FieldError>{errors.confirmPassword.message}</FieldError>}
            </Field>
          )}

          <Field className="mt-2">
            <Button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Carregando..." : isRegister ? "Cadastrar" : "Login"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        Ao continuar, você concorda com nossos <a href="#">Termos de Serviço</a>{" "}
        e <a href="#">Política de Privacidade</a>.
      </FieldDescription>
    </div>
  )
}
