shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

uniform sampler2D albedo_texture : source_color, filter_linear_mipmap;
uniform sampler2D normal_texture : hint_normal, filter_linear_mipmap;
uniform sampler2D metallic_roughness_texture : hint_default_white, filter_linear_mipmap;

uniform vec4 rim_color : source_color = vec4(0.3, 0.85, 1.0, 1.0);
uniform float rim_power : hint_range(0.5, 8.0) = 3.2;
uniform float rim_intensity : hint_range(0.0, 5.0) = 1.8;
uniform vec3 subsurface_tint : source_color = vec3(0.85, 0.25, 0.15);
uniform float wrap_subsurface : hint_range(0.0, 1.0) = 0.35;

void fragment() {
    vec4 albedo_tex = texture(albedo_texture, UV);
    vec4 mr_tex = texture(metallic_roughness_texture, UV);
    
    ALBEDO = albedo_tex.rgb;
    METALLIC = mr_tex.r;
    ROUGHNESS = mr_tex.g;
    NORMAL_MAP = texture(normal_texture, UV).rgb;
    
    // Stylized Silhouette Rim Glow
    float fresnel = 1.0 - clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0);
    fresnel = pow(fresnel, rim_power);
    EMISSION = rim_color.rgb * fresnel * rim_intensity;
}

void light() {
    float n_dot_l = dot(NORMAL, LIGHT);
    float wrapped_light = clamp((n_dot_l + wrap_subsurface) / (1.0 + wrap_subsurface), 0.0, 1.0);
    
    vec3 diffuse_light = wrapped_light * LIGHT_COLOR * ATTENUATION;
    DIFFUSE_LIGHT += diffuse_light * mix(vec3(1.0), subsurface_tint, (1.0 - n_dot_l) * 0.4);
}
