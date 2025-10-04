import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PhoneInput } from '@/components/ui/phone-input';
import { Badge } from '@/components/ui/badge';

interface BasicInfoFormProps {
  form: UseFormReturn<any>;
  user: any;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function BasicInfoForm({ form, user, onNameChange }: BasicInfoFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              <Input {...field} onChange={onNameChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input {...field} type="email" />
            </FormControl>
            <FormDescription>
              Ao alterar o email, você receberá um link de confirmação no novo endereço. O login continuará funcionando com o email atual até que você confirme o novo email.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="language"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Idioma</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o idioma" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="es-ES">Español (España)</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              Idioma da sua vitrine pública
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="currency"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Moeda</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a moeda" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="BRL">BRL - Real Brasileiro</SelectItem>
                <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - Libra Esterlina</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              Moeda para exibição de preços na vitrine
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Telefone</FormLabel>
            <FormControl>
              <PhoneInput {...field} />
            </FormControl>
            <FormDescription>
              Aceita números fixos (10 dígitos) e móveis (11 dígitos)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="whatsapp"
        render={({ field }) => (
          <FormItem>
            <FormLabel>WhatsApp</FormLabel>
            <FormControl>
              <PhoneInput {...field} />
            </FormControl>
            <FormDescription>
              Aceita números fixos (10 dígitos) e móveis (11 dígitos)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="instagram"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Instagram</FormLabel>
            <FormControl>
              <Input {...field} placeholder="@seuinstagram" />
            </FormControl>
            <FormDescription>
              Digite apenas o nome de usuário, sem o '@' ou o link completo
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="location_url"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Link de Localização</FormLabel>
            <FormControl>
              <Input {...field} placeholder="https://maps.google.com/..." />
            </FormControl>
            <FormDescription>
              Link do Google Maps ou outro serviço de localização
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Link da Vitrine</FormLabel>
            <FormControl>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-2">vitrineturbo.com/</span>
                <Input {...field} placeholder="seu-nome" />
              </div>
            </FormControl>
            <FormDescription>
              URL amigável para sua vitrine pública
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}