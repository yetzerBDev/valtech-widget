import type { Metadata } from "next";
import LegalLayout, { LegalSection } from "../components/LegalLayout";

export const metadata: Metadata = {
  title: "Términos y condiciones | Valtech",
};

export default function TerminosPage() {
  return (
    <LegalLayout title="Términos y condiciones" updated="11 de agosto de 2026">
      <LegalSection title="1. Aceptación de los términos">
        <p>
          Al acceder y usar el sistema Valtech, aceptas estos términos y
          condiciones. Si no estás de acuerdo con ellos, no uses el sistema.
        </p>
      </LegalSection>

      <LegalSection title="2. Sistema de uso privado">
        <p>
          El sistema Valtech es una herramienta interna y privada de Valtech.
          El acceso está restringido a personas autorizadas y no es un servicio
          público ni está disponible para el público en general.
        </p>
      </LegalSection>

      <LegalSection title="3. Cuenta y acceso">
        <p>
          Puedes iniciar sesión con tu cuenta de Google. Eres responsable de
          mantener la confidencialidad de tu cuenta y de toda la actividad que
          se realice con ella dentro del sistema.
        </p>
      </LegalSection>

      <LegalSection title="4. Widget de escritorio">
        <p>
          El widget de Valtech se instala en tu equipo y se inicia
          automáticamente al encender el PC. Para garantizar su disponibilidad,
          no se puede cerrar, solo minimizar. Al instalar el widget aceptas
          este comportamiento.
        </p>
      </LegalSection>

      <LegalSection title="5. Uso permitido">
        <p>
          El sistema se usa para consultar y gestionar avalúos, ver
          información y realizar las tareas asignadas dentro de tu ámbito de
          trabajo autorizado.
        </p>
      </LegalSection>

      <LegalSection title="6. Uso no permitido">
        <p>
          No puedes copiar, revender, modificar ni distribuir el sistema o sus
          contenidos, ni acceder a información de otras personas sin
          autorización.
        </p>
      </LegalSection>

      <LegalSection title="7. Propiedad intelectual">
        <p>
          El sistema, su código, la marca y sus contenidos pertenecen a
          Valtech. Nada en estos términos te otorga derechos de propiedad
          sobre ellos.
        </p>
      </LegalSection>

      <LegalSection title="8. Disponibilidad y cambios">
        <p>
          Podemos modificar, suspender o interrumpir el servicio cuando sea
          necesario. Te avisaremos de los cambios relevantes por los canales
          internos de la organización.
        </p>
      </LegalSection>

      <LegalSection title="9. Contacto">
        <p>
          Para cualquier consulta sobre estos términos, contacta al
          administrador del sistema Valtech en{" "}
          <a
            href="mailto:yetzer.valtech@gmail.com"
            className="font-medium text-brand hover:underline"
          >
            yetzer.valtech@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
