import { useState, useEffect } from "react";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader as Loader2, Info } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { supabase } from '@/lib/supabase';

const formSchema = z.object({
  default_listing_limit: z.string()
    .min(1, 'Limite de itens é obrigatório')
    .refine(val => !isNaN(parseInt(val)) && parseInt(val) >= 0, {
      message: 'Deve ser um número maior ou igual a 0'
    }),
  enable_user_registration: z.boolean(),
  default_user_role: z.enum(['corretor', 'parceiro']),
  require_creci: z.boolean(),
  global_meta_pixel_id: z.string()
    .regex(/^\d*$/, 'O ID do Pixel deve conter apenas números')
    .optional()
    .or(z.literal(''))
});

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      default_listing_limit: '5',
      enable_user_registration: true,
      default_user_role: 'corretor',
      require_creci: true,
      global_meta_pixel_id: ''
    }
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('site_settings')
        .select('setting_name, setting_value');

      if (error) throw error;

      const settings = data.reduce((acc, curr) => {
        acc[curr.setting_name] = curr.setting_value;
        return acc;
      }, {} as Record<string, string>);

      form.reset({
        default_listing_limit: settings.default_listing_limit || '5',
        enable_user_registration: settings.enable_user_registration === 'true',
        default_user_role: (settings.default_user_role || 'corretor') as 'corretor' | 'parceiro',
        require_creci: settings.require_creci === 'true',
        global_meta_pixel_id: settings.global_meta_pixel_id || ''
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setSaving(true);

      // Convert values to string format for storage
      const settingsToUpdate = [
        { setting_name: 'default_listing_limit', setting_value: values.default_listing_limit.toString() },
        { setting_name: 'enable_user_registration', setting_value: values.enable_user_registration.toString() },
        { setting_name: 'default_user_role', setting_value: values.default_user_role },
        { setting_name: 'require_creci', setting_value: values.require_creci.toString() },
        { setting_name: 'global_meta_pixel_id', setting_value: values.global_meta_pixel_id || '' }
      ];

      // Update settings
      const { error } = await supabase
        .from('site_settings')
        .upsert(settingsToUpdate, {
          onConflict: 'setting_name'
        });

      if (error) throw error;

      toast.success('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Configurações</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="enable_user_registration"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Registro de Usuários
                        </FormLabel>
                        <FormDescription>
                          Permitir que novos usuários se registrem na plataforma
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="default_user_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função Padrão</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a função padrão" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="corretor">Corretor</SelectItem>
                          <SelectItem value="parceiro">Parceiro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Função atribuída aos novos usuários registrados
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="default_listing_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite de Imóveis Padrão</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormDescription>
                        Quantidade máxima de itens que o corretor pode cadastrar
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="require_creci"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          CRECI Obrigatório
                        </FormLabel>
                        <FormDescription>
                          Exigir número do CRECI para novos corretores
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="global_meta_pixel_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pixel Meta Global</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="123456789" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        ID do Pixel Meta que será aplicado a todas as vitrines públicas. Digite apenas os números do ID do Pixel.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? 'Salvando...' : 'Salvar Configurações'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}