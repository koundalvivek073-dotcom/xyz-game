shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

uniform sampler2D splatmap : hint_default_black, filter_linear_mipmap;
uniform sampler2D tex_grass_albedo : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_grass_normal : hint_normal, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_dirt_albedo : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_dirt_normal : hint_normal, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_rock_albedo : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D tex_rock_normal : hint_normal, filter_linear_mipmap_anisotropic;

uniform float uv_scale_near = 40.0;
uniform float uv_scale_far = 8.0;
uniform float distance_blend_start = 25.0;
uniform float distance_blend_end = 90.0;
uniform float slope_rock_threshold = 0.65;

void fragment() {
    vec2 base_uv = UV;
    float dist = length(VERTEX);
    float blend_factor = clamp((dist - distance_blend_start) / (distance_blend_end - distance_blend_start), 0.0, 1.0);
    
    vec2 uv_near = base_uv * uv_scale_near;
    vec2 uv_far = base_uv * uv_scale_far;
    
    vec4 g_near = texture(tex_grass_albedo, uv_near);
    vec4 g_far  = texture(tex_grass_albedo, uv_far);
    vec4 grass_col = mix(g_near, g_far, blend_factor);
    
    vec4 d_near = texture(tex_dirt_albedo, uv_near);
    vec4 d_far  = texture(tex_dirt_albedo, uv_far);
    vec4 dirt_col = mix(d_near, d_far, blend_factor);
    
    vec4 r_near = texture(tex_rock_albedo, uv_near);
    vec4 r_far  = texture(tex_rock_albedo, uv_far);
    vec4 rock_col = mix(r_near, r_far, blend_factor);
    
    vec4 weights = texture(splatmap, base_uv);
    float total = weights.r + weights.g + weights.b;
    weights = total > 0.001 ? (weights / total) : vec4(1.0, 0.0, 0.0, 0.0);
    
    float slope = 1.0 - UP_DIRECTION.y;
    float rock_weight = smoothstep(slope_rock_threshold - 0.15, slope_rock_threshold + 0.1, slope);
    
    vec3 composite_albedo = mix(
        (grass_col.rgb * weights.r) + (dirt_col.rgb * weights.g) + (rock_col.rgb * weights.b),
        rock_col.rgb,
        rock_weight
    );
    
    ALBEDO = composite_albedo;
    ROUGHNESS = mix(0.85, 0.65, rock_weight);
    METALLIC = 0.02;
    SPECULAR = 0.2;
}
