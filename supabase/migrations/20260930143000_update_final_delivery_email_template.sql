update public.diagnostic_email_templates
set
  subject = 'O resultado do seu Simulador Canadá Sem Filtro está pronto',
  body = 'Olá!\n\nConcluímos a revisão profissional do seu simulador. No relatório, você encontrará uma leitura contextualizada do seu momento, os pontos que pedem atenção e três próximos passos prioritários.\n\nLeia com calma e lembre-se dos limites educacionais apresentados no documento.\n\nCom carinho,\nEquipe Canadá Sem Filtro\n\nImportante: O Simulador Canadá Sem Filtro não é uma consulta de imigração. É um conteúdo educativo para ajudar você a conhecer a realidade de viver no Canadá — incluindo desafios, custos, oportunidades e aspectos que nem sempre aparecem nas redes sociais.\n\nPara uma análise individual do seu perfil imigratório, é necessário agendar uma consulta profissional.',
  version = greatest(version, 3),
  updated_at = now()
where template_key = 'final_delivery'
  and active = true;
