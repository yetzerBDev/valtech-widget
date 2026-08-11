import type { Metadata } from "next";
import LegalLayout, { LegalSection } from "../components/LegalLayout";

export const metadata: Metadata = {
  title: "Política de privacidad | Valtech",
};

export default function PrivacidadPage() {
  return (
    <LegalLayout title="Política de privacidad" updated="11 de agosto de 2026">
      <LegalSection title="1. Introducción">
        <p>
          Esta política explica cómo Valtech maneja la información en el
          sistema Valtech, una herramienta interna y privada.
        </p>
      </LegalSection>

      <LegalSection title="2. Datos que recopilamos">
        <p>
          Al iniciar sesión con tu cuenta de Google, recibimos tu nombre y tu
          dirección de correo. También registramos el uso interno del sistema
          para su correcto funcionamiento.
        </p>
      </LegalSection>

      <LegalSection title="3. Almacenamiento local">
        <p>
          La sesión se guarda de forma local en tu navegador para que no
          tengas que iniciar sesión cada vez. Estos datos permanecen en tu
          equipo y no se envían a terceros.
        </p>
      </LegalSection>

      <LegalSection title="4. Uso de los datos">
        <p>
          Usamos tus datos para verificar tu acceso, mostrarte tus avalúos y
          mantener el funcionamiento del widget en tu equipo.
        </p>
      </LegalSection>

      <LegalSection title="5. Compartición de datos">
        <p>
          No compartimos, vendemos ni cedemos tus datos. Al ser un sistema
          privado, la información solo es accesible para el personal
          autorizado de Valtech.
        </p>
      </LegalSection>

      <LegalSection title="6. Seguridad">
        <p>
          Tomamos medidas técnicas y organizativas razonables para proteger la
          información del sistema frente a accesos no autorizados.
        </p>
      </LegalSection>

      <LegalSection title="7. Retención y eliminación">
        <p>
          Conservamos tu información mientras tu cuenta esté activa. Puedes
          cerrar sesión en cualquier momento, lo que elimina los datos locales
          guardados en tu navegador.
        </p>
      </LegalSection>

      <LegalSection title="8. Cambios en esta política">
        <p>
          Podemos actualizar esta política cuando sea necesario. Los cambios
          se publicarán en esta página y te avisaremos por los canales
          internos de la organización.
        </p>
      </LegalSection>

      <LegalSection title="9. Contacto">
        <p>
          Para cualquier consulta sobre esta política, contacta al
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
