# Relación de cada simulador con el espacio académico «Introducción a las Ciencias del Agua y a la
# Tecnología» (ICAT, primer semestre, USM). La usan generar.py (sección 4 de cada informe), el
# complemento del informe de ríos y la portada de la serie (matriz del curso).
#
# Fuentes: guía magistral de repaso del primer seguimiento (Unidad 1), guías de trabajo académico
# 1 y 2, glosario de las unidades 1 y 2, presentaciones del curso y el taller integrador del tercer
# seguimiento (bloques 1 a 6), revisados en la carpeta del curso.

CURSO = 'Introducción a las Ciencias del Agua y a la Tecnología'

# Unidades y bloques del curso, como los organizan la guía de repaso y el taller integrador
TEMAS_CURSO = [
    ('U1.1', 'El agua como sistema natural y sus cuatro dimensiones (científica, ambiental, social y tecnológica)'),
    ('U1.2', 'Las Ciencias del Agua y su objeto de estudio'),
    ('U1.3', 'Propiedades del agua: polaridad, densidad anómala, capacidad calorífica, calor latente, tensión superficial y solubilidad de gases'),
    ('U1.4', 'Distribución del agua en la Tierra (océanos, glaciares, agua subterránea y superficial)'),
    ('U1.5', 'Ciclo hidrológico, tiempos de residencia y balance P = ETR + Q + ΔS'),
    ('B2', 'Balance hídrico desde cuatro perspectivas: embalse, distrito de riego, cuenca alta y acuífero'),
    ('B3', 'Cuenca, morfometría, red de drenaje, hidrometría y régimen de caudales (flujo base, ríos ganadores y perdedores, curva de duración)'),
    ('B4', 'Condiciones sanitarias, parámetros de calidad y presiones territoriales'),
    ('B5', 'Tecnologías del agua: acueducto (captación, desarenador, aducción, PTAP, almacenamiento y red), saneamiento y cálculos de diseño'),
    ('B6', 'Caso situado: cuenca del río Gaira y acuífero costero de Santa Marta (asignación, caudal ecológico, sequía e intrusión salina)'),
]

INTRO = [
    'El simulador se usa también como material de apoyo del espacio académico **{curso}** (primer semestre del programa Tecnología en Gestión del Agua, ciclo propedéutico a Ingeniería del Agua y Desarrollo Sostenible). Para comprobar que su contenido está de acuerdo con el curso se revisaron la guía de repaso de la Unidad 1, las guías de trabajo académico, el glosario, las presentaciones y el taller integrador del tercer seguimiento (De León Pérez y González Moreno, 2026a, 2026b). La Tabla {tabla} relaciona cada tema del curso con lo que hace el simulador y la pestaña donde se ve.',
]

COMUN_COMPLETAR = [
    'La turbiedad en UNT y la conductividad eléctrica en µS/cm, los parámetros físicos con los que el curso diagnostica el agua frente a la Resolución 2115 de 2007 (2 UNT y 1 000 µS/cm para el agua de consumo), no se calculan: el sedimento se da en mg/L y la transparencia, con el disco Secchi.',
    'La serie no tiene una planta de potabilización (PTAP: coagulación, floculación, sedimentación, filtración y desinfección) ni una de aguas residuales (PTAR): el tren tecnológico del bloque 5 se completa con el curso.',
    'Los valores de las tablas son los del modelo y del escenario base: sirven para razonar y comparar, no reemplazan las mediciones del IDEAM ni los estudios de la autoridad ambiental.',
]

PROYECTOS = {
    'lagunas': {
        'ciencias': 'glaciología, meteorología e hidrometeorología, hidrología, limnología, química del agua y gestión del riesgo y de los recursos hídricos',
        'temas': [
            ('U1.4 Distribución del agua', 'El glaciar del pico es el almacenamiento de agua dulce congelada; se derrite por grado-día y su aporte a la laguna crece en los años secos y a medida que el glaciar se acaba.', 'Clima'),
            ('U1.5 Ciclo hidrológico', 'La lluvia, la evaporación del espejo de agua (Hargreaves), la infiltración y el agua que el suelo del páramo guarda y suelta mueven el nivel de la laguna; el reloj muestra el ciclo día a día y el año mes a mes.', 'Clima, Páramo, Laguna'),
            ('U1.5 y B2 Balance hídrico', 'El balance de la laguna es el del curso con caudales: lo que entra (páramo, glaciar y lluvia) menos lo que sale (evaporación, infiltración, toma y vertedero) es el cambio de volumen; el tiempo de residencia sale del volumen y del caudal.', 'Laguna'),
            ('U1.3 Solubilidad de gases', 'El oxígeno de saturación baja con la temperatura y con la altitud; a 4 300 m el agua hierve por debajo de 100 °C.', 'Calidad'),
            ('B3 Régimen y flujo base', 'El páramo es un embalse lineal: sin lluvia el caudal baja como la recesión del flujo base, Q = Q₀·e^{−t/k}; con el páramo degradado k baja y el agua sale de golpe.', 'Páramo'),
            ('B4 Calidad y presiones', 'Fósforo, clorofila, transparencia (Secchi), índice de Carlson y oxígeno de la madrugada, con las cargas de los potreros, la papa y las jaulas de trucha.', 'Calidad, Sedimentos'),
            ('B6 Riesgo y caudal ecológico', 'Vaciado súbito de una laguna represada por una morrena y tiempo para avisar al pueblo; la revisión del diseño pide que la laguna rebose al menos el 25 % de su caudal medio.', 'Amenazas, Laguna'),
        ],
        'dimensiones': [
            ('Científica', 'Cada resultado sale de una ecuación con los valores sustituidos (grado-día, embalse lineal, paraboloide, Vollenweider, Stokes).'),
            ('Ambiental', 'El páramo como regulador, las plantas sumergidas, el estado trófico y la pérdida del glaciar.'),
            ('Social', 'El pueblo de la quebrada, que depende del acueducto veredal y recibe la alerta si la laguna se vacía.'),
            ('Tecnológica', 'La toma del acueducto, el vertedero de rebose y la alerta temprana.'),
        ],
        'completar': [
            'El balance se hace para la laguna con caudales; la cuenca no se presenta como P = ETR + Q + ΔS con la evapotranspiración real del páramo.',
        ],
    },
    'lagos': {
        'ciencias': 'limnología, hidrología, meteorología, química del agua, ciencias ambientales y gestión de los recursos hídricos',
        'temas': [
            ('U1.3 Densidad anómala', 'El agua es más densa cerca de 4 °C: el lago se estratifica en epilimnion e hipolimnion y se mezcla cuando el viento y el enfriamiento vencen la diferencia de densidad.', 'Temperatura, Viento'),
            ('U1.3 Solubilidad de gases', 'El oxígeno de saturación depende de la temperatura y de la altitud; el hipolimnion pierde oxígeno mientras dura la estratificación.', 'Oxígeno'),
            ('U1.5 Ciclo y balance hídrico', 'La lluvia sobre la cuenca, la escorrentía, la evaporación del espejo y el desagüe dan el nivel del lago y su tiempo de residencia.', 'Cuenca'),
            ('B3 Cuenca y morfometría', 'Área, profundidad media y máxima, volumen y forma de la cubeta, que deciden la estratificación y la carga de nutrientes que el lago resiste.', 'Morfometría'),
            ('B4 Calidad y presiones', 'Fósforo (Vollenweider), clorofila e índice de Carlson; las jaulas de trucha o de peces nativos como presión productiva sobre el lago.', 'Nutrientes, Peces'),
        ],
        'dimensiones': [
            ('Científica', 'Balance térmico y de oxígeno, ecuación de estado del agua y modelos de nutrientes.'),
            ('Ambiental', 'Estado trófico, oxígeno del fondo y especies nativas (capitán de la sabana y guapucha).'),
            ('Social', 'La piscicultura como sustento y los usos del lago aguas abajo.'),
            ('Tecnológica', 'Jaulas de cultivo, carga admisible y control del desagüe.'),
        ],
        'completar': [
            'La cuenca entrega su escorrentía al lago, pero no se presenta un balance P = ETR + Q + ΔS de la cuenca con la evapotranspiración real.',
        ],
    },
    'rios': {
        'ciencias': 'hidrometeorología, hidrología, hidrogeología, hidráulica, química y microbiología del agua, ciencias ambientales y gestión de los recursos hídricos',
        'temas': [
            ('U1.5 Ciclo hidrológico', 'La lluvia de 30 días fija el caudal y el sedimento del río; la del año, el riego y la recarga del acuífero; El Niño y La Niña cambian todo el año.', 'Lluvia, Río'),
            ('B2 Balance de un embalse', 'El embalse de la represa sube o baja con dV/dt = Q que entra − Q que sale, como el ejercicio del embalse de regulación del taller.', 'Represa'),
            ('B2 Distrito de riego (ETR)', 'La evapotranspiración del cultivo (ET₀ por Kc) y la eficiencia del método de riego dan el agua que hay que llevar al lote.', 'Riego, Huella'),
            ('B3 Cuenca y morfometría', 'Tiempo de concentración de Kirpich, método racional y número de Melton para las crecientes de las quebradas y del arroyo de la ciudad.', 'Lluvia, Arroyo'),
            ('B3 Río y acuífero', 'Según el nivel del río y el del acuífero, el río es ganador (efluente) o perdedor (influente); el cono de abatimiento de un pozo puede atraer el agua del río.', 'Acuífero'),
            ('B4 Calidad y presiones', 'Oxígeno disuelto, DBO, coliformes y nitratos aguas abajo de un vertimiento, por zonas alta, media y baja.', 'Río'),
            ('B5 Acueducto y diseño', 'Bocatoma, desarenador, bombeo y aducción, tanque y red; dotación neta y bruta con pérdidas, QMD = k₁·Qmd y QMH = k₂·QMD (Resolución 0330 de 2017).', 'Captación a Vivienda'),
            ('B5 y U1.2 Hidráulica', 'Régimen laminar o turbulento (Reynolds), pérdidas en tuberías, curvas de bombas y NPSH, y canal trapezoidal con Manning.', 'Tuberías, Bombas, Arroyo'),
            ('B6 Caso Gaira, en parte', 'Un río tipo de la Sierra Nevada, como el Gaira, con acueducto, riego y acuífero: la represa siempre suelta un caudal ambiental (un porcentaje del caudal medio) y la sequía de El Niño baja el río. La asignación entre usos, el caudal ecológico de la curva de duración y la intrusión salina se completan con el curso.', 'Represa, Lluvia, Acuífero'),
        ],
        'dimensiones': [
            ('Científica', 'Ecuaciones de hidrología, hidráulica, calidad y agua subterránea con los valores sustituidos.'),
            ('Ambiental', 'Calidad del río por zonas, huella hídrica verde, azul y gris, y el acuífero que puede contaminarse.'),
            ('Social', 'El servicio a las viviendas, la presión en el grifo, el costo de la energía y las amenazas de la lluvia sobre la ciudad.'),
            ('Tecnológica', 'Todo el tren del acueducto, la represa con su central y el canal del arroyo.'),
        ],
        'completar': [
            'En el acueducto, la planta de potabilización iría entre el desarenador y el tanque: hoy el agua cruda pasa del desarenador al tanque y el simulador revisa su calidad en el río (coliformes, DBO y oxígeno), no después de tratarla.',
            'El río es un río tipo de la Sierra Nevada: en la condición normal lleva unos 6 m³/s en la bocatoma, mientras que el Gaira en Minca tiene una mediana de 1.05 m³/s y un Q95 de 0.28 m³/s (IDEAM, 2004–2026, recopilado por Peñaloza Fernández y Wong Lubo, 2026). Para el caso del bloque 6 conviene un escenario «Gaira» con esos caudales, la captación de la planta El Roble y el caudal ecológico.',
            'No se calculan la curva de duración de caudales (Q50, Q95), el balance de asignación Qrío − (Qacueducto + Qriego + Qeco) ni la intrusión salina del acuífero costero cuando se bombea en la sequía.',
        ],
    },
    'cienagas': {
        'ciencias': 'hidrología, oceanografía, limnología de humedales, química del agua, ciencias ambientales y gestión de los recursos hídricos',
        'temas': [
            ('U1.4 y U1.5 Agua dulce y salada', 'La ciénaga mezcla el agua dulce de los ríos y del Magdalena con la del mar: el río la llena en la creciente y ella le devuelve agua en el estiaje.', 'Ríos y caños, Mar y boca'),
            ('U1.5 y B2 Balance hídrico', 'Volumen de la ciénaga con lo que entra por los ríos, los caños y el mar y lo que sale por la boca y la evaporación; tiempo de residencia.', 'Ciénaga'),
            ('U1.3 Densidad y salinidad', 'La salinidad cambia la densidad y el oxígeno de saturación; la ciénaga se saliniza cuando los caños se cierran.', 'Salinidad, Calidad'),
            ('B4 Calidad y presiones', 'Oxígeno, nutrientes y mortandad de peces; la carretera de la barra y los diques del Magdalena, que cortaron el agua dulce y mataron el manglar, como presiones territoriales.', 'Calidad, Manglar y pesca'),
            ('B3 Sedimentos', 'El sedimento que traen los ríos y que se queda en la ciénaga.', 'Sedimentos'),
        ],
        'dimensiones': [
            ('Científica', 'Balance de agua y de sal, mezcla y calidad con sus ecuaciones.'),
            ('Ambiental', 'El manglar y su tolerancia a la sal, la pesca y el oxígeno.'),
            ('Social', 'Los pueblos palafíticos y los pescadores que dependen de la ciénaga.'),
            ('Tecnológica', 'Apertura y dragado de caños y obras que cambian el intercambio con el mar.'),
        ],
        'completar': [],
    },
    'deltas': {
        'ciencias': 'hidrología, hidráulica, oceanografía, ciencias ambientales y gestión de los recursos hídricos',
        'temas': [
            ('B3 Régimen de caudales', 'El caudal del río grande en el año (régimen bimodal con dos crecientes), con sus máximos y mínimos mensuales y el caudal mínimo para la navegación.', 'Río y sedimento'),
            ('B3 Sedimento', 'Curva de sedimento: la concentración crece con el caudal como una potencia; la carga del año alimenta el delta y las playas.', 'Río y sedimento, Avance del delta'),
            ('U1.2 Hidráulica', 'Reparto del caudal entre el cauce principal y el Canal del Dique con la conductancia de Manning.', 'Brazos del delta'),
            ('U1.3 Densidad', 'El agua salada, más densa, entra por el fondo como una cuña bajo el agua dulce del río.', 'Cuña salina'),
            ('B5 Tecnología', 'El canal de acceso al puerto entre los tajamares: se ahonda con la creciente, se llena en la sequía y la draga lo devuelve al calado de diseño.', 'Canal y dragado'),
        ],
        'dimensiones': [
            ('Científica', 'Manning, curva de sedimento, cuña salina y avance del frente con sus ecuaciones.'),
            ('Ambiental', 'La pluma de sedimento en el mar y el sedimento que llega a la bahía de Cartagena por el Dique.'),
            ('Social', 'El puerto, la navegación y la llanura que se inunda.'),
            ('Tecnológica', 'Dragado, tajamares y obras de control del reparto de caudales.'),
        ],
        'completar': [],
    },
    'costas': {
        'ciencias': 'oceanografía, hidráulica costera, microbiología del agua, ciencias ambientales y gestión de los recursos hídricos',
        'temas': [
            ('U1.4 Océanos', 'El mar como el gran reservorio del planeta y el que fija el nivel, las olas y la marea de la playa.', 'Oleaje, Marea y nivel'),
            ('B6 Desembocadura del Gaira', 'La playa de El Rodadero está en la bahía de Gaira, en la desembocadura del río del caso de estudio del curso.', 'Escena'),
            ('B4 Condiciones sanitarias', 'Coliformes fecales en el agua de baño: la pluma del emisario submarino, la corriente que la lleva a la costa y el sol que mata las bacterias, frente al límite de 200 por cada 100 mL.', 'Agua de baño'),
            ('B3 Sedimento y perfil', 'La arena que se mueve con el oleaje, el perfil de equilibrio y el retroceso de la playa con la regla de Bruun.', 'Perfil de playa, Arena de la playa, Ascenso del mar'),
        ],
        'dimensiones': [
            ('Científica', 'Teoría lineal del oleaje, rompiente, remonte y perfil de equilibrio.'),
            ('Ambiental', 'La erosión de la playa y la calidad del agua de baño.'),
            ('Social', 'El turismo y la salud de los bañistas.'),
            ('Tecnológica', 'Emisario submarino, espolones y alimentación artificial de arena.'),
        ],
        'completar': [
            'La relación con el río Gaira es de lugar: el caudal y la calidad del río no entran como variables de la playa, salvo por la lluvia que empeora el agua de baño.',
        ],
    },
    'oceanos': {
        'ciencias': 'oceanografía, meteorología, química del agua, ciencias ambientales y gestión de los recursos hídricos',
        'temas': [
            ('U1.4 Distribución del agua', 'El océano guarda cerca del 96.5 % del agua de la Tierra; el simulador muestra cómo se mueve y cómo cambia.', 'Olas, Mareas, Viento y corrientes'),
            ('U1.3 Capacidad calorífica', 'El mar guarda calor y modera el clima de la costa; cuando se calienta de más, el coral se blanquea (semanas de calor acumulado).', 'Temperatura y coral'),
            ('U1.3 Densidad', 'La densidad del agua de mar depende de la temperatura y de la salinidad (ecuación de estado).', 'Salinidad y densidad'),
            ('U1.5 Condensación', 'En la Serranía de Macuira la niebla se condensa sobre el bosque y los atrapanieblas la convierten en agua para las comunidades.', 'Bosque de niebla'),
            ('U1.3 Solubilidad de gases', 'El CO₂ que el mar disuelve baja el pH y el estado de saturación del aragonito (acidificación).', 'Carbono y acidez'),
        ],
        'dimensiones': [
            ('Científica', 'Olas, mareas, Ekman y afloramiento, ecuación de estado y química del carbonato.'),
            ('Ambiental', 'Coral, afloramiento, bosque de niebla y nivel del mar.'),
            ('Social', 'Las comunidades wayuu de la alta Guajira y el agua de los atrapanieblas.'),
            ('Tecnológica', 'Atrapanieblas y su rendimiento en litros por metro cuadrado de malla.'),
        ],
        'completar': [],
    },
    'sistema': {
        'ciencias': 'todas las del curso, una por eslabón: glaciología y limnología arriba, hidrología e hidráulica en el río, oceanografía en el mar y gestión de los recursos hídricos en toda la red',
        'temas': [
            ('U1.1 Mapa sistémico', 'La red del agua es el mapa sistémico del curso hecho modelo: nodos (laguna, lago, río, ciénaga, delta, océano y playa) y flechas que dicen qué entrega cada uno a su vecino.', 'Red del agua'),
            ('U1.5 Ciclo y tiempos de residencia', 'El caudal y la edad del agua a lo largo de la cadena: el agua tarda días en el río y meses o años en los lagos.', 'Caudal y tiempo, Calidad y trazadores'),
            ('U1.1 Aguas arriba y aguas abajo', 'Lo que se hace arriba (un vertimiento, una represa, un páramo degradado) llega a la ciénaga, al delta y a la playa: la corresponsabilidad del curso.', 'Calidad y trazadores, Sedimento'),
            ('U1.5 Variabilidad climática', 'El Niño y La Niña cambian la lluvia de toda la región a la vez; el horizonte agrega el ascenso del mar y la pérdida del glaciar.', 'Clima y horizonte'),
        ],
        'dimensiones': [
            ('Científica', 'Composición de funciones y matriz de adyacencia de la red (álgebra lineal).'),
            ('Ambiental', 'La calidad y el sedimento que viajan del páramo al mar.'),
            ('Social', 'Los usuarios de cada eslabón, que dependen de lo que hacen los de arriba.'),
            ('Tecnológica', 'Las intervenciones de cada simulador (represas, vertimientos, dragados) vistas en toda la cadena.'),
        ],
        'completar': [],
    },
}

REFERENCIAS = [
    'De León Pérez, D. R., y González Moreno, J. J. (2026a). *Guía magistral de repaso: primer seguimiento. Introducción a las Ciencias del Agua y a la Tecnología* [Material de clase]. Institución Universitaria de Santa Marta.',
    'De León Pérez, D. R., y González Moreno, J. J. (2026b). *Taller integrador y guía de preparación al examen final. Introducción a las Ciencias del Agua y a la Tecnología* [Material de clase]. Institución Universitaria de Santa Marta.',
    'Peñaloza Fernández, A. M., y Wong Lubo, E. C. M. (2026). *Expediente técnico preliminar: río Gaira* (Guía de trabajo académico n.º 2, Introducción a las Ciencias del Agua y a la Tecnología) [Trabajo de clase]. Institución Universitaria de Santa Marta.',
    'Ministerio de la Protección Social y Ministerio de Ambiente, Vivienda y Desarrollo Territorial. (2007). *Resolución 2115 de 2007: características, instrumentos básicos y frecuencias del sistema de control y vigilancia para la calidad del agua para consumo humano*.',
]


def bloques(pid, n_seccion=4, n_tabla=None):
    """Bloques (formato de contenido/<id>.py) de la sección del curso para el informe de un proyecto."""
    P = PROYECTOS[pid]
    t = f'{n_tabla}' if n_tabla else 'siguiente'
    out = [('h1', f'{n_seccion}. Relación con el curso {CURSO}')]
    for p in INTRO:
        out.append(('p', p.format(curso=CURSO, tabla=t)))
    out.append(('tabla', {'titulo': f'Temas del curso {CURSO} en el simulador', 'cabecera': ['Tema del curso', 'Cómo aparece en el simulador', 'Pestaña'],
                          'filas': [list(f) for f in P['temas']], 'anchos': [2.1, 5.2, 1.6],
                          'nota': 'U: unidad de la guía de repaso; B: bloque del taller integrador del tercer seguimiento.'}))
    out.append(('h2', f'{n_seccion}.1 Las Ciencias del Agua y las cuatro dimensiones'))
    out.append(('p', f'El simulador reúne {P["ciencias"]}, como pide el curso: ninguna ciencia sola explica el sistema. También muestra las cuatro dimensiones con las que el curso mira el agua:'))
    out.append(('tabla', {'titulo': 'Las cuatro dimensiones del agua en el simulador', 'cabecera': ['Dimensión', 'En el simulador'],
                          'filas': [list(f) for f in P['dimensiones']], 'anchos': [1.6, 6.6]}))
    out.append(('h2', f'{n_seccion}.2 Lo que se completa con el curso'))
    out.append(('p', 'La revisión encontró el contenido de acuerdo con el curso en sus conceptos y su vocabulario. Estos temas del curso no están en el simulador o están solo en parte, y se trabajan en clase:'))
    out.append(('li', P['completar'] + COMUN_COMPLETAR))
    out.append(('p', 'La pestaña Informe ayuda en los talleres: arma un informe de la simulación con un código QR que abre el simulador con los mismos valores, de modo que el docente o los compañeros pueden repetir el caso.'))
    return out
